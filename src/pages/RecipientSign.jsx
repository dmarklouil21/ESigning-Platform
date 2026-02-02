import React, { useEffect, useState, useRef, useMemo } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Loader2, AlertTriangle, Calendar, Type, ChevronLeft, ChevronRight, CheckCircle, Download } from 'lucide-react';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { signInAnonymously } from "firebase/auth";
import { db, storage, logAction, auth } from '../firebase';
import { Document, Page, pdfjs } from 'react-pdf';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import SignatureModal from '../components/SignatureModal';

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

const RecipientSign = () => {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [docData, setDocData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [finishing, setFinishing] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const [currentRecipient, setCurrentRecipient] = useState(null);
  const [signatures, setSignatures] = useState([]);

  const [numPages, setNumPages] = useState(null);
  // const [pageNumber, setPageNumber] = useState(1); // REMOVED

  const [isSigModalOpen, setIsSigModalOpen] = useState(false);
  const [activePlaceholderId, setActivePlaceholderId] = useState(null);

  const fieldRefs = useRef({}); // Refs for scrolling

  useEffect(() => {
    const fetchDoc = async () => {
      try {
        await signInAnonymously(auth);

        const docRef = doc(db, "documents", id);
        const snapshot = await getDoc(docRef);

        if (!snapshot.exists()) {
          setError("Document not found.");
          setLoading(false);
          return;
        }

        const data = snapshot.data();
        const recipient = data.recipients.find(r => String(r.tokenId).trim() === String(token).trim());

        if (!recipient) {
          setError("Access denied. Invalid or expired token.");
          setLoading(false);
          return;
        }

        setDocData(data);
        setSignatures(data.signatures || []);
        setCurrentRecipient(recipient);
      } catch (err) {
        console.error(err);
        setError("Error loading document.");
      } finally {
        setLoading(false);
      }
    };
    fetchDoc();
  }, [id, token]);

  const handlePlaceholderClick = (item) => {
    if (item.recipientId !== currentRecipient.id) return;

    if (item.type === 'placeholder') {
      setActivePlaceholderId(item.id);
      setIsSigModalOpen(true);
    } else if (item.type === 'placeholder-date') {
      fillPlaceholder(item.id, new Date().toLocaleDateString(), 'text');
    } else if (item.type === 'placeholder-name') {
      fillPlaceholder(item.id, currentRecipient.name, 'text');
    }
  };

  const handleSaveSignature = (url) => {
    fillPlaceholder(activePlaceholderId, url, 'image');
    setIsSigModalOpen(false);

    // Auto-scroll to next
    setTimeout(() => scrollToNext(activePlaceholderId), 100);
  };

  const scrollToNext = (justFilledId) => {
    // 1. Get current (just filled) sig to compare position
    const currentSig = signatures.find(s => s.id === justFilledId);
    if (!currentSig) return;

    // 2. Find all remaining placeholders for ME
    const myRemaining = signatures.filter(s =>
      s.recipientId === currentRecipient.id &&
      s.type.startsWith('placeholder') &&
      s.id !== justFilledId // Exclude the one we just filled
    );

    if (myRemaining.length === 0) return;

    // 3. Sort by position (Page -> Y -> X)
    const sorted = [...myRemaining].sort((a, b) => {
      if (a.page !== b.page) return a.page - b.page;
      if (a.y !== b.y) return a.y - b.y;
      return a.x - b.x;
    });

    // 4. Find first one located "after" the current one
    const nextFn = (s) => {
      if (s.page > currentSig.page) return true;
      if (s.page === currentSig.page && s.y > currentSig.y + 10) return true; // +10 tolerance
      return false;
    };

    const nextOne = sorted.find(nextFn);

    // 5. If found, scroll. If not (we are at bottom), wrap to top (first in sorted).
    const target = nextOne || sorted[0];

    if (target && fieldRefs.current[target.id]) {
      fieldRefs.current[target.id].scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  const fillPlaceholder = (id, value, type) => {
    const updatedSignatures = signatures.map(sig => {
      if (sig.id === id) {
        return {
          ...sig,
          type: type === 'image' ? 'image' : 'text',
          url: type === 'image' ? value : null,
          text: type === 'text' ? value : null,
          filledBy: currentRecipient.id,
          isRemoteSigned: true
        };
      }
      return sig;
    });
    setSignatures(updatedSignatures);
  };

  const generateSignedPDF = async () => {
    const existingPdfBytes = await fetch(docData.fileUrl).then(res => res.arrayBuffer());
    const pdfDoc = await PDFDocument.load(existingPdfBytes);
    const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const pages = pdfDoc.getPages();

    for (const item of signatures) {
      if (item.type.startsWith('placeholder')) continue;

      const pageIndex = item.page - 1;
      if (pageIndex < 0 || pageIndex >= pages.length) continue;

      const page = pages[pageIndex];
      const { width: pdfPageWidth, height: pdfPageHeight } = page.getSize();

      const scaleRatio = pdfPageWidth / 600;
      const yCorrection = 4;

      const x = item.x * scaleRatio;
      const y = pdfPageHeight - ((item.y + item.height) * scaleRatio) + yCorrection;
      const w = item.width * scaleRatio;
      const h = item.height * scaleRatio;

      if (item.type === 'text') {
        const fontSize = h * 0.6;
        const textY = y + (h * 0.25);
        page.drawText(item.text, { x, y: textY, size: fontSize, font: helveticaFont, color: rgb(0, 0, 0) });
      } else if (item.type === 'image') {

        const sigImageBytes = await fetch(item.url).then(res => res.arrayBuffer());
        let sigImage;
        try {
          sigImage = await pdfDoc.embedPng(sigImageBytes);
        } catch (e) {
          sigImage = await pdfDoc.embedJpg(sigImageBytes);
        }

        // --- ASPECT RATIO FIX START ---
        const imgDims = sigImage.scale(1); // Get native dimensions
        const imgWidth = imgDims.width;
        const imgHeight = imgDims.height;
        const imgRatio = imgWidth / imgHeight;

        // The box dimensions on the PDF page
        const boxWidth = w;
        const boxHeight = h;
        const boxRatio = boxWidth / boxHeight;

        let finalWidth = boxWidth;
        let finalHeight = boxHeight;

        // Calculate "Contain" logic (Fit image inside box without stretching)
        if (imgRatio > boxRatio) {
          // Image is wider than the box: Constrain by width
          finalWidth = boxWidth;
          finalHeight = boxWidth / imgRatio;
        } else {
          // Image is taller than the box: Constrain by height
          finalHeight = boxHeight;
          finalWidth = boxHeight * imgRatio;
        }

        // Center the image within the placeholder box
        const xOffset = (boxWidth - finalWidth) / 2;
        const yOffset = (boxHeight - finalHeight) / 2;

        // Draw with calculated dimensions
        page.drawImage(sigImage, {
          x: x + xOffset,
          y: y + yOffset,
          width: finalWidth,
          height: finalHeight
        });
        // --- ASPECT RATIO FIX END ---
      }
    }

    return await pdfDoc.save();
  };

  // --- UPDATED FINISH HANDLER ---
  const handleFinish = async () => {
    const pendingCount = signatures.filter(s =>
      s.type.startsWith('placeholder') && s.recipientId === currentRecipient.id
    ).length;

    if (pendingCount > 0) {
      alert(`You have ${pendingCount} fields left to fill.`);
      return;
    }

    setFinishing(true);

    try {
      // 1. Burn PDF
      const pdfBytes = await generateSignedPDF();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });

      // 2. Upload
      const storageRef = ref(storage, docData.storagePath);
      const metadata = {
        contentType: 'application/pdf',
        contentDisposition: `attachment; filename="signed_${docData.name}"`,
      };
      await uploadBytes(storageRef, blob, metadata);

      const newUrl = await getDownloadURL(storageRef);

      const remainingSignatures = signatures.filter(s => s.type.startsWith('placeholder'));

      // 3. Logic: Update Recipient Status & Check if ALL are done
      const updatedRecipients = docData.recipients.map(r =>
        r.id === currentRecipient.id ? { ...r, status: 'completed', signedAt: new Date() } : r
      );

      // Check if EVERY recipient has completed
      const allComplete = updatedRecipients.every(r => r.status === 'completed');
      const newStatus = allComplete ? 'Completed' : 'Sent'; // If all done, mark Completed. Else stay Sent.

      // 4. Update Firestore
      await updateDoc(doc(db, "documents", id), {
        fileUrl: newUrl, // The burned PDF
        status: newStatus, // 'Completed' or 'Sent'
        signatures: remainingSignatures,
        lastModified: new Date(),
        recipients: updatedRecipients
      });

      await logAction(
        id,
        "Signed by Recipient",
        `${currentRecipient.name} has completed the signing process.`,
        currentRecipient.email
      );

      // Update local state for the success screen
      setDocData(prev => ({ ...prev, fileUrl: newUrl }));
      setSuccess(true);
    } catch (err) {
      console.error("Error burning PDF:", err);
      alert("Failed to save. " + err.message);
    } finally {
      setFinishing(false);
    }
  };

  // const changePage = (offset) => setPageNumber(prev => Math.min(Math.max(1, prev + offset), numPages || 1)); // REMOVED

  // --- Helper: Download for Recipient ---
  const downloadSignedDoc = () => {
    const link = document.createElement('a');
    link.href = docData.fileUrl;
    link.download = `signed_${docData.name}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) return <div className="h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-purple-600" /></div>;
  if (error) return <div className="h-screen flex flex-col items-center justify-center text-red-500 gap-2"><AlertTriangle className="w-10 h-10" /><h2 className="text-xl font-bold">{error}</h2></div>;

  // --- UPDATED SUCCESS SCREEN ---
  if (success) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-slate-50 p-4 animate-fade-in">
        <div className="bg-white p-10 rounded-2xl shadow-xl text-center max-w-md w-full border border-slate-100">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-10 h-10 text-green-600" />
          </div>
          <h1 className="text-2xl font-bold text-slate-800 mb-2">You're All Set!</h1>
          <p className="text-slate-500 mb-8">
            Thank you, {currentRecipient.name}. The document has been securely signed.
          </p>

          {/* Download Button for Recipient */}
          <button
            onClick={downloadSignedDoc}
            className="w-full py-3 bg-purple-600 text-white font-bold rounded-lg hover:bg-purple-700 transition-colors flex items-center justify-center gap-2 mb-4 shadow-md"
          >
            <Download className="w-5 h-5" /> Download Copy
          </button>

          <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 text-sm text-slate-600">
            You can now close this tab.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-slate-100">
      <header className="bg-white border-b border-slate-200 px-6 py-3 flex justify-between items-center z-20">
        <div>
          <h1 className="font-bold text-slate-800 text-sm md:text-base">{docData.name}</h1>
          <p className="text-xs text-slate-500">Signing as <span className="font-bold text-purple-600">{currentRecipient.name}</span></p>
        </div>
        <button
          onClick={handleFinish}
          disabled={finishing}
          className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-2 rounded-lg font-bold shadow-md transition-colors disabled:bg-purple-300 flex items-center gap-2"
        >
          {finishing && <Loader2 className="w-4 h-4 animate-spin" />}
          {finishing ? "Finalizing..." : "Finish Signing"}
        </button>
      </header>

      <div className="flex-1 overflow-auto p-4 md:p-8 flex justify-center bg-slate-200/50 pb-32">
        <div className="flex flex-col items-center">
          {docData?.fileUrl && (
            <Document
              file={docData.fileUrl}
              onLoadSuccess={({ numPages }) => setNumPages(numPages)}
              loading={<div className="h-96 flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-purple-600" /></div>}
            >
              {numPages && Array.from(new Array(numPages), (_, index) => {
                const pageNum = index + 1;
                return (
                  <div key={pageNum} className="relative shadow-xl border border-slate-300 bg-white mb-8 select-none">
                    <Page pageNumber={pageNum} scale={1.0} renderTextLayer={false} renderAnnotationLayer={false} />

                    {/* Overlay Signatures/Placeholders for this page */}
                    {signatures
                      .filter(item => item.page === pageNum)
                      .map(item => {
                        const isMyBox = item.recipientId === currentRecipient.id;
                        const isPlaceholder = item.type.startsWith('placeholder');
                        let styleClass = "absolute border-2 transition-all flex items-center justify-center ";

                        if (isPlaceholder) {
                          if (isMyBox) {
                            styleClass += "bg-yellow-100/80 border-yellow-500 cursor-pointer hover:bg-yellow-200 animate-pulse-slow shadow-md";
                          } else {
                            styleClass += "bg-slate-100/50 border-slate-300 cursor-not-allowed opacity-60 grayscale";
                          }
                        } else {
                          styleClass += "border-transparent";
                        }

                        return (
                          <div
                            key={item.id}
                            ref={el => fieldRefs.current[item.id] = el} // Ref for auto-scroll
                            onClick={() => handlePlaceholderClick(item)}
                            className={styleClass}
                            style={{ left: item.x, top: item.y, width: item.width, height: item.height, zIndex: 50 }}
                          >
                            {item.type === 'placeholder' && (
                              <div className="text-center">
                                <span className={`text-[10px] font-bold uppercase tracking-wider ${isMyBox ? 'text-yellow-800' : 'text-slate-500'}`}>
                                  {isMyBox ? "Sign Here" : "Other Signer"}
                                </span>
                              </div>
                            )}
                            {item.type === 'placeholder-date' && (
                              <div className="flex flex-col items-center text-yellow-800"><Calendar className="w-4 h-4 mb-1" /><span className="text-[9px] font-bold uppercase">Date</span></div>
                            )}
                            {item.type === 'placeholder-name' && (
                              <div className="flex flex-col items-center text-yellow-800"><Type className="w-4 h-4 mb-1" /><span className="text-[9px] font-bold uppercase">Name</span></div>
                            )}
                            {item.type === 'image' && <img src={item.url} className="w-full h-full object-contain" alt="Signature" />}
                            {item.type === 'text' && <div className="w-full h-full flex items-center justify-center whitespace-nowrap" style={{ fontSize: `${item.height * 0.6}px`, fontFamily: 'Helvetica' }}>{item.text}</div>}
                          </div>
                        );
                      })}
                  </div>
                );
              })}
            </Document>
          )}
        </div>
      </div>

      {/* Page Controls Removed */}

      <SignatureModal isOpen={isSigModalOpen} onClose={() => setIsSigModalOpen(false)} onSave={handleSaveSignature} />
    </div>
  );
};

export default RecipientSign;