import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Download, PenTool, Eraser, X, ChevronLeft, ChevronRight, Loader2, Save, Calendar, User } from 'lucide-react'; 
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, updateMetadata } from 'firebase/storage';
import { db, storage, logAction } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { Rnd } from 'react-rnd';
import SignatureModal from '../components/SignatureModal';
import FinishModal from '../components/FinishModal';

import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'; 
import emailjs from '@emailjs/browser'; 
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

// --- Draggable Component ---
const DraggableElement = ({ data, onUpdate, onRemove, isSelected, onSelect }) => {
  return (
    <Rnd
      default={{ x: data.x, y: data.y, width: data.width, height: data.height || 60 }}
      onDragStop={(e, d) => { onUpdate(data.id, { x: d.x, y: d.y }); }}
      onResizeStop={(e, direction, ref, delta, position) => {
        onUpdate(data.id, { width: parseInt(ref.style.width), height: parseInt(ref.style.height), ...position });
      }}
      onDragStart={() => onSelect(data.id)}
      onClick={(e) => {
        e.stopPropagation(); 
        onSelect(data.id);
      }}
      bounds="parent"
      lockAspectRatio={data.type !== 'text'} 
      className={`group z-50 border-2 relative transition-colors ${
        isSelected ? 'border-blue-500' : 'border-transparent hover:border-blue-400'
      }`}
    >
      {data.type === 'text' ? (
        <div 
          className="w-full h-full flex items-center justify-center text-slate-900 select-none cursor-move whitespace-nowrap" 
          style={{ fontSize: `${data.height * 0.6}px`, lineHeight: 1, fontFamily: 'Helvetica, sans-serif' }}
        >
            {data.text}
        </div>
      ) : (
        <img 
          src={data.url} 
          alt="signature" 
          className="w-full h-full block pointer-events-none select-none" 
          draggable={false}
        />
      )}

      <button 
        onMouseDown={(e) => { e.stopPropagation(); onRemove(data.id); }} 
        onTouchStart={(e) => { e.stopPropagation(); onRemove(data.id); }} 
        className={`absolute -top-3 -right-3 bg-red-500 text-white rounded-full p-1 shadow-sm z-50 cursor-pointer transition-opacity ${
          isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
        }`}
      >
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
  const [savingDraft, setSavingDraft] = useState(false); 
  
  const [userProfile, setUserProfile] = useState({ firstName: '', lastName: '' });
  const [selectedId, setSelectedId] = useState(null);

  const [numPages, setNumPages] = useState(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [scale, setScale] = useState(1.0);

  const [isSigModalOpen, setIsSigModalOpen] = useState(false);
  const [isFinishModalOpen, setIsFinishModalOpen] = useState(false);
  
  const [signatures, setSignatures] = useState([]);

  const hasSignature = signatures.some(sig => sig.type === 'image');

  useEffect(() => {
    const fetchUserProfile = async () => {
      if (user?.uid) {
        try {
          const userDocRef = doc(db, "users", user.uid);
          const userSnap = await getDoc(userDocRef);
          if (userSnap.exists()) {
            setUserProfile(userSnap.data());
          }
        } catch (error) {
          console.error("Error fetching user profile:", error);
        }
      }
    };
    fetchUserProfile();
  }, [user]);

  useEffect(() => {
    const fetchDocument = async () => {
      try {
        const docRef = doc(db, "documents", id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          setDocumentData(data);
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

  const addTextElement = (text) => {
    const safeText = text || "User";
    const newElement = {
      id: Date.now(),
      type: 'text',
      text: safeText,
      x: 50, 
      y: 100, 
      width: Math.max(100, safeText.length * 10), 
      height: 30,
      page: pageNumber
    };
    setSignatures([...signatures, newElement]);
    setSelectedId(newElement.id); 
  };

  const handleAddDate = () => {
    const dateStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    addTextElement(dateStr);
  };

  const handleAddName = (type) => {
    if (!userProfile.firstName && !userProfile.lastName) {
       const names = (user.displayName || "").split(' ');
       if (type === 'first') addTextElement(names[0]);
       if (type === 'last') addTextElement(names.slice(1).join(' '));
       return;
    }
    if (type === 'first') addTextElement(userProfile.firstName);
    if (type === 'last') addTextElement(userProfile.lastName);
  };

  const handleSaveSignature = (url) => {
    const img = new Image();
    img.src = url;
    img.onload = () => {
      const aspectRatio = img.naturalWidth / img.naturalHeight;
      const baseWidth = 200;
      const calculatedHeight = baseWidth / aspectRatio;

      const newSig = { 
        id: Date.now(), 
        type: 'image', 
        url, 
        x: 50, y: 100, 
        width: baseWidth, height: calculatedHeight, 
        page: pageNumber 
      };
      setSignatures([...signatures, newSig]);
      setSelectedId(newSig.id); 
    };
  };

  const handleSaveDraft = async () => {
    setSavingDraft(true);
    try {
      await updateDoc(doc(db, "documents", id), {
        signatures: signatures, 
        lastModified: new Date(),
        status: 'Draft' 
      });
    } catch (error) {
      console.error("Error saving draft:", error);
      alert("Failed to save draft.");
    }
    await logAction(id, "Draft Saved", "User saved positions.");
    setSavingDraft(false);
  };

  const generateSignedPDF = async () => {
    const existingPdfBytes = await fetch(documentData.fileUrl).then(res => res.arrayBuffer());
    const pdfDoc = await PDFDocument.load(existingPdfBytes);
    const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);

    const pages = pdfDoc.getPages();
    const firstPage = pages[0];
    const { height: pdfPageHeight } = firstPage.getSize();
    const pdfPageWidth = firstPage.getWidth();
    const domPageWidth = pdfContainerRef.current.offsetWidth; 
    const scaleRatio = pdfPageWidth / domPageWidth;

    for (const item of signatures) {
      const pageIndex = item.page - 1; 
      if (pageIndex < 0 || pageIndex >= pages.length) continue;

      const page = pages[pageIndex];
      const x = item.x * scaleRatio;
      const y = pdfPageHeight - ((item.y + item.height) * scaleRatio); 
      const w = item.width * scaleRatio;
      const h = item.height * scaleRatio;

      if (item.type === 'text') {
        const fontSize = h * 0.6; 
        const textY = y + (h * 0.25); 

        page.drawText(item.text, {
          x: x,
          y: textY,
          size: fontSize,
          font: helveticaFont,
          color: rgb(0, 0, 0),
        });

      } else {
        const sigImageBytes = await fetch(item.url).then(res => res.arrayBuffer());
        let sigImage;
        try {
          sigImage = await pdfDoc.embedPng(sigImageBytes);
        } catch (e) {
          sigImage = await pdfDoc.embedJpg(sigImageBytes); 
        }
        page.drawImage(sigImage, { x, y, width: w, height: h });
      }
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
      signatures: [] 
    });

    await logAction(id, "Document Signed", "User finalized document.");
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
      const storageRef = ref(storage, documentData.storagePath);
      await updateMetadata(storageRef, {
        contentDisposition: `attachment; filename="signed_${documentData.name}"`,
        contentType: 'application/pdf'
      });
      
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
      await logAction(id, "Document Emailed", `Sent to ${recipientEmail}`);
      setProcessing(false);
      return true;
    } catch (error) {
      console.error("Email failed", error);
      alert("Failed to send email.");
      setProcessing(false);
      return false;
    }
  };

  const changePage = (offset) => setPageNumber(prev => Math.min(Math.max(1, prev + offset), numPages || 1));
  const updateElement = (id, props) => setSignatures(signatures.map(s => s.id === id ? { ...s, ...props } : s));
  const removeElement = (id) => setSignatures(signatures.filter(s => s.id !== id));

  const handleBackgroundClick = () => setSelectedId(null);

  if (loading) return <div className="h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-blue-600"/></div>;

  const tools = [
    { icon: <PenTool className="w-5 h-5" />, label: "Sign", action: () => setIsSigModalOpen(true) },
    { icon: <Calendar className="w-5 h-5" />, label: "Date", action: handleAddDate },
    { icon: <User className="w-5 h-5" />, label: "First Name", action: () => handleAddName('first') },
    { icon: <User className="w-5 h-5" />, label: "Last Name", action: () => handleAddName('last') },
    { icon: <Eraser className="w-5 h-5" />, label: "Clear", action: () => setSignatures([]) },
  ];

  return (
    <div className="flex flex-col h-screen bg-slate-100 overflow-hidden">
      {/* HEADER */}
      <header className="bg-white border-b border-slate-200 px-4 md:px-6 py-3 flex justify-between items-center shadow-sm z-20 relative">
        <div className="flex items-center gap-2 md:gap-4">
          <button onClick={() => navigate('/dashboard')} className="p-2 hover:bg-slate-100 rounded-full transition-colors"><ArrowLeft className="w-5 h-5 text-slate-600" /></button>
          <h1 className="font-bold text-slate-800 truncate max-w-[150px] md:max-w-[200px] text-sm md:text-base">{documentData?.name}</h1>
        </div>
        
        <div className="flex items-center gap-2">
          <button 
            onClick={handleSaveDraft}
            disabled={savingDraft}
            className="flex items-center gap-2 px-3 py-2 text-slate-600 bg-white border border-slate-200 text-xs md:text-sm font-medium rounded-lg hover:bg-slate-50 transition-colors"
          >
            {savingDraft ? <Loader2 className="w-4 h-4 animate-spin"/> : <Save className="w-4 h-4" />}
            <span className="hidden md:inline">Save Draft</span>
          </button>

          <button 
            onClick={() => setIsFinishModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 shadow-sm"
          >
            <Download className="w-4 h-4" /> 
            <span className="hidden md:inline">Finish & Send</span>
          </button>
          {/* <div className="relative group">
            <button 
              onClick={() => setIsFinishModalOpen(true)}
              disabled={!hasSignature}
              className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white text-xs md:text-sm font-medium rounded-lg hover:bg-blue-700 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-slate-400 transition-all"
            >
              <Download className="w-4 h-4" /> 
              <span className="hidden md:inline">Finish</span>
            </button>
            {!hasSignature && (
              <div className="hidden md:block absolute top-full right-0 mt-2 w-48 p-2 bg-slate-800 text-white text-xs rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 text-center">
                Please add a signature to finish.
              </div>
            )}
          </div> */}
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden relative">
        {/* --- DESKTOP SIDEBAR --- */}
        <aside className="hidden md:flex w-20 bg-white border-r border-slate-200 flex-col items-center py-6 gap-6 z-20 overflow-y-auto">
          {tools.map((tool, idx) => (
            <React.Fragment key={idx}>
               <ToolButton icon={tool.icon} label={tool.label} onClick={tool.action} />
               {(idx === 1 || idx === 3) && <div className="w-10 border-b border-slate-200 my-1"></div>}
            </React.Fragment>
          ))}
        </aside>

        {/* --- MAIN CONTENT AREA --- */}
        <main 
          className="flex-1 bg-slate-200/50 overflow-auto relative" 
          onClick={handleBackgroundClick} 
        >
          {/* Scrollable Container with Extra Bottom Padding */}
          <div className="min-w-fit min-h-full flex flex-col items-center p-4 md:p-8 pb-40">
            
            <div ref={pdfContainerRef} className="relative inline-block shadow-2xl border border-slate-300 bg-white select-none">
              {documentData?.fileUrl && (
                <Document 
                  file={documentData.fileUrl} 
                  onLoadSuccess={onDocumentLoadSuccess} 
                  // --- FIX: Mimic A4/Letter Aspect Ratio for Loading State ---
                  loading={
                    <div className="w-[85vw] md:w-[600px] aspect-[1/1.41] flex items-center justify-center bg-white text-slate-400">
                      <div className="flex flex-col items-center gap-2">
                        <Loader2 className="w-10 h-10 animate-spin text-blue-600"/>
                        <span className="text-sm font-medium">Loading Document...</span>
                      </div>
                    </div>
                  }
                >
                  <Page 
                    pageNumber={pageNumber} 
                    scale={scale} 
                    renderTextLayer={false} 
                    renderAnnotationLayer={false}
                    className="max-w-full h-auto" 
                  />
                </Document>
              )}
              {signatures.filter(sig => sig.page === pageNumber).map((item) => (
                <DraggableElement 
                  key={item.id} 
                  data={item} 
                  onUpdate={updateElement} 
                  onRemove={removeElement} 
                  isSelected={selectedId === item.id} 
                  onSelect={setSelectedId}            
                />
              ))}
            </div>

          </div>
          
          {/* Page Controls */}
          {numPages && numPages > 1 && (
            <div className="fixed bottom-24 md:bottom-8 left-1/2 transform -translate-x-1/2 bg-white px-4 py-2 md:px-6 md:py-3 rounded-full shadow-xl border border-slate-200 flex items-center gap-4 md:gap-6 z-40">
              <button disabled={pageNumber <= 1} onClick={() => changePage(-1)} className="p-2 hover:bg-slate-100 rounded-full disabled:opacity-30"><ChevronLeft className="w-5 h-5 md:w-6 md:h-6" /></button>
              <span className="text-xs md:text-sm font-semibold text-slate-700 min-w-[60px] text-center">Page {pageNumber} of {numPages}</span>
              <button disabled={pageNumber >= numPages} onClick={() => changePage(1)} className="p-2 hover:bg-slate-100 rounded-full disabled:opacity-30"><ChevronRight className="w-5 h-5 md:w-6 md:h-6" /></button>
            </div>
          )}
        </main>
      </div>

      {/* --- MOBILE BOTTOM TOOLBAR --- */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 z-50 px-2 py-2 flex justify-around items-end shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
        {tools.map((tool, idx) => (
          <ToolButton key={idx} icon={tool.icon} label={tool.label} onClick={tool.action} mobile />
        ))}
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

const ToolButton = ({ icon, label, onClick, active, mobile }) => (
  <button 
    onClick={onClick} 
    className={`flex flex-col items-center gap-1 p-2 rounded-lg transition-all 
      ${active ? 'text-blue-600 bg-blue-50' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'}
      ${mobile ? 'flex-1 min-w-[50px]' : ''} 
    `}
  >
    {icon} 
    <span className="text-[10px] font-medium text-center leading-tight">{label}</span>
  </button>
);

export default Editor;