import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Download, PenTool, Eraser, X, ChevronLeft, ChevronRight, Loader2, Save } from 'lucide-react'; // Added Save icon
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage, logAction } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { Rnd } from 'react-rnd';
import SignatureModal from '../components/SignatureModal';
import FinishModal from '../components/FinishModal';

import { PDFDocument } from 'pdf-lib'; 
import emailjs from '@emailjs/browser'; 
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

// --- Draggable Component ---
const DraggableSignature = ({ sig, onUpdate, onRemove }) => {
  return (
    <Rnd
      default={{ x: sig.x, y: sig.y, width: sig.width, height: sig.height || 60 }}
      onDragStop={(e, d) => { onUpdate(sig.id, { x: d.x, y: d.y }); }}
      onResizeStop={(e, direction, ref, delta, position) => {
        onUpdate(sig.id, { width: parseInt(ref.style.width), height: parseInt(ref.style.height), ...position });
      }}
      bounds="parent"
      className="group z-50 border-2 border-transparent hover:border-blue-400 relative"
    >
      <img src={sig.url} alt="signature" className="w-full h-full object-contain pointer-events-none select-none" />
      <button onMouseDown={(e) => { e.stopPropagation(); onRemove(sig.id); }} className="absolute -top-3 -right-3 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity shadow-sm z-50 cursor-pointer">
        <X className="w-3 h-3" />
      </button>
    </Rnd>
  );
};

const Editor = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const pdfContainerRef = useRef(null); 
  
  const [documentData, setDocumentData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false); // New state for draft saving
  
  const [numPages, setNumPages] = useState(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [scale, setScale] = useState(1.0);

  const [isSigModalOpen, setIsSigModalOpen] = useState(false);
  const [isFinishModalOpen, setIsFinishModalOpen] = useState(false);
  const [signatures, setSignatures] = useState([]);

  useEffect(() => {
    const fetchDocument = async () => {
      try {
        const docRef = doc(db, "documents", id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          setDocumentData(data);
          
          // --- RESTORE STATE: If draft signatures exist, load them ---
          if (data.signatures) {
            setSignatures(data.signatures);
          }
        } else {
          navigate('/dashboard');
        }
      } catch (err) {
        console.error("Error fetching doc:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchDocument();
  }, [id, navigate]);

  function onDocumentLoadSuccess({ numPages }) {
    setNumPages(numPages);
  }

  // --- NEW FEATURE: Save Draft ---
  const handleSaveDraft = async () => {
    setSavingDraft(true);
    try {
      // We save the 'signatures' array directly to Firestore.
      // This preserves their x, y, width, height, and page number.
      await updateDoc(doc(db, "documents", id), {
        signatures: signatures, // Save the array
        lastModified: new Date(),
        status: 'Draft' // Optional: Mark as Draft
      });
      alert("Draft saved successfully! You can come back later.");
    } catch (error) {
      console.error("Error saving draft:", error);
      alert("Failed to save draft.");
    }

    await logAction(id, "Draft Saved", "User saved signature positions.");
    setSavingDraft(false);
  };

  const generateSignedPDF = async () => {
    const existingPdfBytes = await fetch(documentData.fileUrl).then(res => res.arrayBuffer());
    const pdfDoc = await PDFDocument.load(existingPdfBytes);
    const pages = pdfDoc.getPages();

    const firstPage = pages[0];
    const { width: pdfPageWidth, height: pdfPageHeight } = firstPage.getSize();
    const domPageWidth = pdfContainerRef.current.offsetWidth; 
    const scaleRatio = pdfPageWidth / domPageWidth;

    for (const sig of signatures) {
      const pageIndex = sig.page - 1; 
      if (pageIndex < 0 || pageIndex >= pages.length) continue;

      const page = pages[pageIndex];
      const sigImageBytes = await fetch(sig.url).then(res => res.arrayBuffer());
      
      let sigImage;
      try {
        sigImage = await pdfDoc.embedPng(sigImageBytes);
      } catch (e) {
        sigImage = await pdfDoc.embedJpg(sigImageBytes); 
      }

      const x = sig.x * scaleRatio;
      const y = pdfPageHeight - ((sig.y + sig.height) * scaleRatio); 
      const w = sig.width * scaleRatio;
      const h = sig.height * scaleRatio;

      page.drawImage(sigImage, { x, y, width: w, height: h });
    }

    return await pdfDoc.save();
  };

  const saveToFirebase = async () => {
    const pdfBytes = await generateSignedPDF();
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    const storageRef = ref(storage, documentData.storagePath);
    await uploadBytes(storageRef, blob);
    const updatedUrl = await getDownloadURL(storageRef);

    await updateDoc(doc(db, "documents", id), { 
      status: 'Signed',
      fileUrl: updatedUrl,
      lastModified: new Date().toISOString(),
      signatures: [] // Clear draft signatures since it is now baked in
    });

    await logAction(id, "Document Signed", "User finalized and signed the document.");

    return { blob, url: updatedUrl };
  };

  const handleDownload = async () => {
    setProcessing(true);
    try {
      const { blob } = await saveToFirebase();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `signed_${documentData.name}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setIsFinishModalOpen(false);
    } catch (error) {
      console.error("Download failed", error);
      alert("Failed to save and download.");
    }
    setProcessing(false);
  };

  const handleEmail = async (recipientEmail) => {
    setProcessing(true);
    try {
      const { url } = await saveToFirebase();
      const templateParams = {
        to_email: recipientEmail,
        document_name: documentData.name,
        download_link: url,
        from_name: user.displayName || user.email, 
        from_email: user.email,
        reply_to: user.email,
        message: "Please find the signed document attached via the link below."
      };

      await emailjs.send('service_g23671h', 'template_n5lpdpv', templateParams, '0WB5-X4FNk0oe3RAt');
      await updateDoc(doc(db, "documents", id), { status: 'Sent' });
      
      await logAction(id, "Document Emailed", `Signed PDF sent to ${recipientEmail}`);
      setProcessing(false);
      return true;
    } catch (error) {
      console.error("Email failed", error);
      alert("Failed to send email.");
      setProcessing(false);
      return false;
    }
  };

  // Helpers
  const changePage = (offset) => setPageNumber(prev => Math.min(Math.max(1, prev + offset), numPages || 1));
  const handleSaveSignature = (url) => setSignatures([...signatures, { id: Date.now(), url, x: 50, y: 50, width: 200, height: 100, page: pageNumber }]);
  const updateSignature = (id, props) => setSignatures(signatures.map(s => s.id === id ? { ...s, ...props } : s));
  const removeSignature = (id) => setSignatures(signatures.filter(s => s.id !== id));

  if (loading) return <div className="h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-blue-600"/></div>;

  return (
    <div className="flex flex-col h-screen bg-slate-100 overflow-hidden">
      <header className="bg-white border-b border-slate-200 px-6 py-3 flex justify-between items-center shadow-sm z-20 relative">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/dashboard')} className="p-2 hover:bg-slate-100 rounded-full transition-colors"><ArrowLeft className="w-5 h-5 text-slate-600" /></button>
          <h1 className="font-bold text-slate-800 truncate max-w-[200px]">{documentData?.name}</h1>
        </div>
        
        {/* Buttons Group */}
        <div className="flex items-center gap-2">
          {/* 1. Save Draft Button */}
          <button 
            onClick={handleSaveDraft}
            disabled={savingDraft}
            className="flex items-center gap-2 px-4 py-2 text-slate-600 bg-white border border-slate-200 text-sm font-medium rounded-lg hover:bg-slate-50 transition-colors"
          >
            {savingDraft ? <Loader2 className="w-4 h-4 animate-spin"/> : <Save className="w-4 h-4" />}
            <span className="hidden md:inline">Save Draft</span>
          </button>

          {/* 2. Finish Button */}
          <button 
            onClick={() => setIsFinishModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 shadow-sm"
          >
            <Download className="w-4 h-4" /> 
            <span className="hidden md:inline">Finish & Send</span>
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden relative">
        <aside className="w-20 bg-white border-r border-slate-200 flex flex-col items-center py-6 gap-6 z-20 relative">
          <ToolButton icon={<PenTool className="w-5 h-5" />} label="Sign" onClick={() => setIsSigModalOpen(true)} active />
          <ToolButton icon={<Eraser className="w-5 h-5" />} label="Clear All" onClick={() => setSignatures([])} />
        </aside>

        <main className="flex-1 bg-slate-200/50 overflow-auto flex justify-center p-8 relative">
          <div className="flex flex-col items-center gap-4 mb-20">
            <div ref={pdfContainerRef} className="relative inline-block shadow-2xl border border-slate-300 bg-white select-none">
              {documentData?.fileUrl && (
                <Document file={documentData.fileUrl} onLoadSuccess={onDocumentLoadSuccess} loading={<div className="h-[600px] w-[500px] flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-blue-600"/></div>}>
                  <Page pageNumber={pageNumber} scale={scale} renderTextLayer={false} renderAnnotationLayer={false} />
                </Document>
              )}
              {signatures.filter(sig => sig.page === pageNumber).map((sig) => (
                <DraggableSignature key={sig.id} sig={sig} onUpdate={updateSignature} onRemove={removeSignature} />
              ))}
            </div>
          </div>
          {numPages && numPages > 1 && (
            <div className="fixed bottom-8 left-1/2 transform -translate-x-1/2 bg-white px-6 py-3 rounded-full shadow-xl border border-slate-200 flex items-center gap-6 z-50">
              <button disabled={pageNumber <= 1} onClick={() => changePage(-1)} className="p-2 hover:bg-slate-100 rounded-full disabled:opacity-30"><ChevronLeft className="w-6 h-6" /></button>
              <span className="text-sm font-semibold text-slate-700 min-w-[80px] text-center">Page {pageNumber} of {numPages}</span>
              <button disabled={pageNumber >= numPages} onClick={() => changePage(1)} className="p-2 hover:bg-slate-100 rounded-full disabled:opacity-30"><ChevronRight className="w-6 h-6" /></button>
            </div>
          )}
        </main>
      </div>

      <SignatureModal isOpen={isSigModalOpen} onClose={() => setIsSigModalOpen(false)} onSave={handleSaveSignature} />
      
      <FinishModal 
        isOpen={isFinishModalOpen} 
        onClose={() => setIsFinishModalOpen(false)}
        onDownload={handleDownload}
        onEmail={handleEmail}
        processing={processing}
      />
    </div>
  );
};

const ToolButton = ({ icon, label, onClick, active }) => (
  <button onClick={onClick} className={`flex flex-col items-center gap-1 p-2 rounded-lg transition-all ${active ? 'text-blue-600 bg-blue-50' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'}`}>
    {icon} <span className="text-[10px] font-medium">{label}</span>
  </button>
);

export default Editor;