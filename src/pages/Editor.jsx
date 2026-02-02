import React, { useEffect, useState, useRef, memo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Download, PenTool, Eraser, X, ChevronLeft, ChevronRight, Loader2, Save, Calendar, User, UserPlus, PlusSquare, Type } from 'lucide-react';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, updateMetadata } from 'firebase/storage';
import { db, storage, logAction } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { Rnd } from 'react-rnd';
import SignatureModal from '../components/SignatureModal';
import FinishModal from '../components/FinishModal';
import RecipientModal from '../components/RecipientModal';
import AssignRecipientModal from '../components/AssignRecipientModal'; // Ensure this is imported

import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import emailjs from '@emailjs/browser';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

// --- Memoized Page Wrapper ---
const PageWrapper = memo(({ pageNumber, scale, children, setRef }) => {
  return (
    <div
      ref={setRef}
      className="relative shadow-2xl border border-slate-300 bg-white select-none mb-8"
    >
      <Page
        pageNumber={pageNumber}
        scale={scale}
        renderTextLayer={false}
        renderAnnotationLayer={false}
        className="max-w-full h-auto"
      />
      {children}
    </div>
  );
}, (prev, next) => {
  // Only re-render if scale or pageNumber changes (children handled separately, but since children are DraggableElements they update themselves via their own memo? 
  // Rnd is a separate component. Passing children here might break memoization if children array usually changes identity.
  // Actually, standard memo shallow comparison of children (React Elements) will always be false if parent re-renders.
  // We can trust React.memo on PageWrapper or just let it re-render if props change.
  // But wait, if we drop DraggableElement inside, and `signatures` state changes, `children` changes.
  // So PageWrapper will re-render exactly when needed (when signatures change).
  return prev.pageNumber === next.pageNumber && prev.scale === next.scale && prev.children === next.children;
});

// --- Memoized Draggable Element ---
const DraggableElement = memo(({ data, onUpdate, onRemove, isSelected, onSelect, getRecipientName }) => {
  const isSignaturePlaceholder = data.type === 'placeholder';
  const isDatePlaceholder = data.type === 'placeholder-date';
  const isNamePlaceholder = data.type === 'placeholder-name';
  const isAnyPlaceholder = isSignaturePlaceholder || isDatePlaceholder || isNamePlaceholder;

  return (
    <Rnd
      default={{ x: data.x, y: data.y, width: data.width, height: data.height || 60 }}
      onDragStop={(e, d) => {
        if (d.x !== data.x || d.y !== data.y) {
          onUpdate(data.id, { x: d.x, y: d.y });
        }
      }}
      onResizeStop={(e, direction, ref, delta, position) => {
        onUpdate(data.id, { width: parseInt(ref.style.width), height: parseInt(ref.style.height), ...position });
      }}
      onDragStart={() => !isSelected && onSelect(data.id)}
      onClick={(e) => { e.stopPropagation(); onSelect(data.id); }}
      // bounds="parent" // REMOVED
      lockAspectRatio={data.type === 'image'}
      className={`group z-50 border-2 relative transition-colors ${isSelected ? 'border-blue-500' : 'border-transparent hover:border-blue-400'
        } ${isAnyPlaceholder ? 'bg-yellow-100/80 border-yellow-400 border-dashed' : ''}`}
    >
      {/* Content Rendering */}
      {data.type === 'text' && (
        <div className="w-full h-full flex items-center justify-center text-slate-900 select-none cursor-move whitespace-nowrap" style={{ fontSize: `${data.height * 0.6}px`, lineHeight: 1, fontFamily: 'Helvetica, sans-serif' }}>{data.text}</div>
      )}
      {data.type === 'image' && (
        <img src={data.url} alt="signature" className="w-full h-full block pointer-events-none select-none" draggable={false} />
      )}

      {/* Placeholders */}
      {isSignaturePlaceholder && (
        <div className="w-full h-full flex flex-col items-center justify-center text-center p-1 select-none">
          <span className="text-[10px] font-bold text-yellow-700 uppercase tracking-wider">Sign Here</span>
          <div className="w-full h-px bg-yellow-400 my-1"></div>
          <span className="text-[9px] text-yellow-800 truncate w-full px-1">{getRecipientName(data.recipientId)}</span>
        </div>
      )}
      {isDatePlaceholder && (
        <div className="w-full h-full flex flex-col items-center justify-center text-center p-1 select-none">
          <Calendar className="w-4 h-4 text-yellow-700 mb-1" />
          <span className="text-[9px] font-bold text-yellow-700 uppercase">Date</span>
          <span className="text-[8px] text-yellow-800 truncate w-full px-1">{getRecipientName(data.recipientId)}</span>
        </div>
      )}
      {isNamePlaceholder && (
        <div className="w-full h-full flex flex-col items-center justify-center text-center p-1 select-none">
          <Type className="w-4 h-4 text-yellow-700 mb-1" />
          <span className="text-[9px] font-bold text-yellow-700 uppercase">Name</span>
          <span className="text-[8px] text-yellow-800 truncate w-full px-1">{getRecipientName(data.recipientId)}</span>
        </div>
      )}

      {/* Delete Button */}
      <button
        onMouseDown={(e) => { e.stopPropagation(); onRemove(data.id); }}
        onTouchStart={(e) => { e.stopPropagation(); onRemove(data.id); }}
        className={`absolute -top-3 -right-3 bg-red-500 text-white rounded-full p-1 shadow-sm z-50 cursor-pointer transition-opacity ${isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
      >
        <X className="w-3 h-3" />
      </button>
    </Rnd>
  );
}, (prev, next) => {
  return (
    prev.data.x === next.data.x &&
    prev.data.y === next.data.y &&
    prev.data.width === next.data.width &&
    prev.data.height === next.data.height &&
    prev.isSelected === next.isSelected
  );
});

const Editor = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const pdfContainerRef = useRef(null);
  const pageRefs = useRef({}); // NEW: Track all pages for drag detection

  const [documentData, setDocumentData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);

  const [userProfile, setUserProfile] = useState({ firstName: '', lastName: '' });
  const [selectedId, setSelectedId] = useState(null);

  const [numPages, setNumPages] = useState(null);
  // const [pageNumber, setPageNumber] = useState(1); // REMOVED
  const [scale, setScale] = useState(1.0);

  const [isSigModalOpen, setIsSigModalOpen] = useState(false);
  const [isFinishModalOpen, setIsFinishModalOpen] = useState(false);
  const [isRecipientModalOpen, setIsRecipientModalOpen] = useState(false);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [pendingToolType, setPendingToolType] = useState(null);

  const [signatures, setSignatures] = useState([]);
  const [recipients, setRecipients] = useState([]);

  const isCompleted = documentData?.status === 'Completed';

  const isRemote = documentData?.type === 'OTHERS';

  // --- Callbacks for Memoization ---
  // UPDATED: Handle Cross-Page Dragging
  const updateElement = useCallback((id, props, event = null) => {
    setSignatures(prev => {
      // If no event (resize) or no pages, just update props
      if (!event || !pageRefs.current) {
        return prev.map(s => s.id === id ? { ...s, ...props } : s);
      }

      const clientX = event.clientX || (event.changedTouches && event.changedTouches[0]?.clientX);
      const clientY = event.clientY || (event.changedTouches && event.changedTouches[0]?.clientY);

      if (!clientX || !clientY) return prev.map(s => s.id === id ? { ...s, ...props } : s);

      // Find which page we are over
      let targetPage = null;
      let relativeX = props.x;
      let relativeY = props.y;

      for (const [pageNum, ref] of Object.entries(pageRefs.current)) {
        if (!ref) continue;
        const rect = ref.getBoundingClientRect();
        // Simple hit test
        if (clientY >= rect.top && clientY <= rect.bottom && clientX >= rect.left && clientX <= rect.right) {
          targetPage = parseInt(pageNum);
          relativeX = clientX - rect.left;
          relativeY = clientY - rect.top;
          break;
        }
      }

      // If we found a new page (or same page but verifying coords), update
      if (targetPage) {
        // Adjust for element centering if needed? Rnd 'x,y' is top-left.
        // When dragging, 'props.x/y' from Rnd are relative to original parent.
        // We want new parent relative coords.
        // But wait, Rnd onDragStop returns 'd.x/d.y' relative to its helper parent.
        // If we re-parent it, we need 0-based coords relative to the new page.
        // The calculated relativeX/Y are relative to the *target page* top-left.
        // IMPORTANT: Rnd drag offset usually is top-left of the element.
        // The event mouse position is usually inside the element. 
        // Better logic: Calculate offset of mouse from element top-left at start?
        // Simplified: Use the mouse position relative to page as top-left (approx).
        // A more precise way requires knowing the grab offset.
        // For MVP: Let's center it or just use mouse position - 20px? 
        // Or just use the raw calculation, user can adjust.

        // Correction: 'd.x' is useless if we change parents.
        // accurateX = relativeX - (mouseOffsetX)
        // Let's assume user grabs near middle-ish or top-left.
        // Let's use the calculated relative coords but subtract half width/height for better feel?
        // We can get current Width/Height from the previous state of the element.
        const currentItem = prev.find(s => s.id === id);
        const w = props.width || currentItem.width;
        const h = props.height || currentItem.height;

        // Centering logic approx
        const adjustedX = relativeX - (w / 2);
        const adjustedY = relativeY - (h / 2);

        return prev.map(s => s.id === id ? {
          ...s,
          ...props,
          page: targetPage,
          x: Math.max(0, adjustedX), // Simple bounds check
          y: Math.max(0, adjustedY)
        } : s);
      }

      // Fallback: If dropped outside any page, keep original page but bounds might be weird.
      // Or snap to original page.
      return prev.map(s => s.id === id ? { ...s, ...props } : s);
    });
  }, []);

  const removeElement = useCallback((id) => {
    setSignatures(prev => prev.filter(s => s.id !== id));
  }, []);

  const handleSelect = useCallback((id) => {
    setSelectedId(prev => (prev === id ? prev : id));
  }, []);

  const getRecipientName = useCallback((rId) => {
    const r = recipients.find(rec => rec.id === rId);
    return r ? r.name : "Unknown";
  }, [recipients]);

  useEffect(() => {
    const fetchUserProfile = async () => {
      if (user?.uid) {
        try {
          const userDocRef = doc(db, "users", user.uid);
          const userSnap = await getDoc(userDocRef);
          if (userSnap.exists()) setUserProfile(userSnap.data());
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
          if (data.signatures) setSignatures(data.signatures);
          if (data.recipients) setRecipients(data.recipients);
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

  // --- Helper: Get Visible Page ---
  const getActivePage = () => {
    if (!pageRefs.current || Object.keys(pageRefs.current).length === 0) return 1;

    // Simple logic: Find the first page that is closest to 100px from top
    let bestPage = 1;
    let closestDist = Infinity;

    for (const [pageNum, ref] of Object.entries(pageRefs.current)) {
      if (!ref) continue;
      const rect = ref.getBoundingClientRect();
      const dist = Math.abs(rect.top - 100);
      if (dist < closestDist) {
        closestDist = dist;
        bestPage = parseInt(pageNum);
      }
    }
    return bestPage;
  };



  // --- Handlers ---
  const handleAddRecipient = (recipientData) => {
    const newRecipient = { id: `recipient_${Date.now()}`, name: recipientData.name, email: recipientData.email, status: 'pending', tokenId: crypto.randomUUID() };
    setRecipients([...recipients, newRecipient]);
  };

  const handleRemoteToolClick = (type) => {
    setPendingToolType(type);
    setIsAssignModalOpen(true);
  };

  const handleAssignRecipient = (recipientId) => {
    let width = 120;
    let height = 50;
    if (pendingToolType === 'placeholder-date') { width = 100; height = 40; }
    if (pendingToolType === 'placeholder-name') { width = 150; height = 40; }

    const targetPage = getActivePage();
    const newPlaceholder = {
      id: Date.now(),
      type: pendingToolType,
      recipientId,
      x: 100, y: 100,
      width, height,
      page: targetPage
    };
    setSignatures(prev => [...prev, newPlaceholder]);
    setSelectedId(newPlaceholder.id);
    setPendingToolType(null);
  };

  const addTextElement = (text) => {
    const safeText = text || "User";
    const targetPage = getActivePage();
    const newElement = { id: Date.now(), type: 'text', text: safeText, x: 50, y: 100, width: Math.max(100, safeText.length * 10), height: 30, page: targetPage };
    setSignatures([...signatures, newElement]);
    setSelectedId(newElement.id);
  };

  const handleAddDate = () => addTextElement(new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }));

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
      const targetPage = getActivePage();
      const newSig = { id: Date.now(), type: 'image', url, x: 50, y: 100, width: baseWidth, height: calculatedHeight, page: targetPage };
      setSignatures([...signatures, newSig]);
      setSelectedId(newSig.id);
    };
  };

  const handleSaveDraft = async () => {
    setSavingDraft(true);
    try {
      await updateDoc(doc(db, "documents", id), {
        signatures: signatures, recipients: recipients, lastModified: new Date(), status: 'Draft'
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
      if (item.type.startsWith('placeholder')) continue;
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
        page.drawText(item.text, { x, y: textY, size: fontSize, font: helveticaFont, color: rgb(0, 0, 0) });
      } else {
        const sigImageBytes = await fetch(item.url).then(res => res.arrayBuffer());
        let sigImage;
        try { sigImage = await pdfDoc.embedPng(sigImageBytes); } catch (e) { sigImage = await pdfDoc.embedJpg(sigImageBytes); }
        page.drawImage(sigImage, { x, y, width: w, height: h });
      }
    }
    return await pdfDoc.save();
  };

  const saveToFirebase = async () => {
    if (recipients.length > 0) {
      await updateDoc(doc(db, "documents", id), { status: 'Sent', signatures: signatures, recipients: recipients });
      return { url: documentData.fileUrl };
    }
    const pdfBytes = await generateSignedPDF();
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    const storageRef = ref(storage, documentData.storagePath);
    await uploadBytes(storageRef, blob);
    const updatedUrl = await getDownloadURL(storageRef);
    await updateDoc(doc(db, "documents", id), { status: 'Signed', fileUrl: updatedUrl, lastModified: new Date().toISOString(), signatures: [] });
    await logAction(id, "Document Signed", "User finalized document.");
    return { blob, url: updatedUrl };
  };

  const handleDownload = async () => {
    setProcessing(true);
    try {
      // --- CASE 1: Document is already Completed (Just Download) ---
      if (isCompleted) {
        const response = await fetch(documentData.fileUrl);
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `signed_${documentData.name}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setProcessing(false);
        return;
      }

      // --- CASE 2: Self-Sign (Burn & Download) ---
      const { blob } = await saveToFirebase();
      if (blob) {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `signed_${documentData.name}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        alert("Document sent to recipients!");
      }
      setIsFinishModalOpen(false);
    } catch (error) {
      console.error("Download failed", error);
      alert("Failed to save.");
    }
    setProcessing(false);
  };

  const handleEmail = async (targetEmail) => {
    setProcessing(true);
    try {
      // SCENARIO A: REMOTE SIGNING (Send Invites)
      if (isRemote && recipients.length > 0) {

        // 1. Save state first to ensure tokens are in DB
        await updateDoc(doc(db, "documents", id), {
          status: 'Sent',
          signatures: signatures,
          recipients: recipients,
          lastModified: new Date()
        });

        // 2. Loop through recipients and send individual emails
        const emailPromises = recipients.map(recipient => {
          // Construct the unique signing link
          const signingLink = `${window.location.origin}/sign/${id}?token=${recipient.tokenId}`;

          const templateParams = {
            to_email: recipient.email,      // Send to THIS specific person
            to_name: recipient.name,
            from_name: user.displayName || user.email,
            document_name: documentData.name,
            // The template in EmailJS should use {{action_link}} or similar
            action_link: signingLink,
            message: `You have been invited to sign ${documentData.name}. Click the link below to access the document securely.`
          };

          // Send the email (Make sure your EmailJS template supports these variables!)
          return emailjs.send('service_g23671h', 'template_n5lpdpv', templateParams, '0WB5-X4FNk0oe3RAt');
        });

        // Wait for all emails to send
        await Promise.all(emailPromises);

        // alert(`Sent ${recipients.length} invitations successfully!`);
        // navigate('/dashboard'); 
        setProcessing(false);
        return true;
      }

      // SCENARIO B: SELF-SIGN (Send Attachment)
      else {
        const { url } = await saveToFirebase();

        // Update metadata for proper attachment behavior
        const storageRef = ref(storage, documentData.storagePath);
        await updateMetadata(storageRef, {
          contentDisposition: `attachment; filename="signed_${documentData.name}"`,
          contentType: 'application/pdf'
        });

        const templateParams = {
          to_email: targetEmail,
          document_name: documentData.name,
          download_link: url, // This is the direct file URL
          from_name: user.displayName || user.email,
          from_email: user.email,
          reply_to: user.email,
          message: "Please find the signed document attached via the link below."
        };

        await emailjs.send('service_g23671h', 'template_n5lpdpv', templateParams, '0WB5-X4FNk0oe3RAt');
        await updateDoc(doc(db, "documents", id), { status: 'Sent' });

        setProcessing(false);
        return true;
      }

    } catch (error) {
      console.error("Email failed", error);
      alert("Failed to send email.");
      setProcessing(false);
      return false;
    }
  };

  // const changePage = (offset) => setPageNumber(prev => Math.min(Math.max(1, prev + offset), numPages || 1)); // REMOVED
  const handleBackgroundClick = () => setSelectedId(null);

  if (loading) return <div className="h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>;

  const selfSignTools = [
    { icon: <PenTool className="w-5 h-5" />, label: "Sign", action: () => setIsSigModalOpen(true) },
    { icon: <Calendar className="w-5 h-5" />, label: "Date", action: handleAddDate },
    { icon: <User className="w-5 h-5" />, label: "First Name", action: () => handleAddName('first') },
    { icon: <User className="w-5 h-5" />, label: "Last Name", action: () => handleAddName('last') },
    { icon: <Eraser className="w-5 h-5" />, label: "Clear", action: () => setSignatures([]) },
  ];

  return (
    <div className="flex flex-col h-screen bg-slate-100 overflow-hidden">
      <header className="bg-white border-b border-slate-200 px-4 md:px-6 py-3 flex justify-between items-center shadow-sm z-20 relative">
        <div className="flex items-center gap-2 md:gap-4">
          <button onClick={() => navigate('/dashboard')} className="p-2 hover:bg-slate-100 rounded-full transition-colors"><ArrowLeft className="w-5 h-5 text-slate-600" /></button>
          <h1 className="font-bold text-slate-800 truncate max-w-[150px] md:max-w-[200px] text-sm md:text-base">{documentData?.name}</h1>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleSaveDraft} disabled={savingDraft} className="flex items-center gap-2 px-3 py-2 text-slate-600 bg-white border border-slate-200 text-xs md:text-sm font-medium rounded-lg hover:bg-slate-50 transition-colors">
            {savingDraft ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            <span className="hidden md:inline">Draft</span>
          </button>
          <div className="relative group">
            {/* THE MAIN ACTION BUTTON */}
            <button
              // Logic: If Completed -> Run Download. If Not -> Open Modal.
              onClick={isCompleted ? handleDownload : () => setIsFinishModalOpen(true)}

              // Logic: Disable if empty (unless it's already completed)
              // disabled={(!signatures.some(s=>s.type==='image') && !isRemote && !isCompleted) || (isRemote && recipients.length === 0 && !isCompleted)}

              className={`flex items-center gap-2 px-3 py-2 text-white text-xs md:text-sm font-medium rounded-lg shadow-sm transition-all disabled:opacity-50 bg-blue-600 hover:bg-blue-700`}
            >
              {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}

              {/* Dynamic Label */}
              <span className="hidden md:inline">
                {isCompleted
                  ? "Download"
                  : (recipients.length > 0 ? "Send Envelope" : "Finish")
                }
              </span>
            </button>
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden relative">
        <aside className="hidden md:flex w-24 bg-white border-r border-slate-200 flex-col items-center py-6 gap-4 z-20 overflow-y-auto">
          {!isRemote && selfSignTools.map((tool, idx) => (
            <React.Fragment key={idx}>
              <button onClick={tool.action} className="flex flex-col items-center gap-1 p-2 rounded-lg transition-all text-slate-500 hover:text-slate-800 hover:bg-slate-50">
                {tool.icon} <span className="text-[10px] font-medium text-center">{tool.label}</span>
              </button>
              {(idx === 1 || idx === 3) && <div className="w-10 border-b border-slate-200 my-1"></div>}
            </React.Fragment>
          ))}

          {isRemote && (
            <>
              <div className="text-[10px] font-bold text-slate-400 text-center uppercase tracking-wider mb-2">Fields</div>

              <button onClick={() => handleRemoteToolClick('placeholder')} className="flex flex-col items-center gap-1 p-3 rounded-xl transition-all bg-yellow-50 text-yellow-700 hover:bg-yellow-100 border border-yellow-200 w-20 shadow-sm">
                <PlusSquare className="w-6 h-6" />
                <span className="text-[10px] font-bold text-center">Signature</span>
              </button>

              <button onClick={() => handleRemoteToolClick('placeholder-date')} className="flex flex-col items-center gap-1 p-3 rounded-xl transition-all bg-white text-slate-600 hover:bg-slate-50 border border-slate-200 w-20 shadow-sm">
                <Calendar className="w-6 h-6" />
                <span className="text-[10px] font-medium text-center">Date</span>
              </button>

              <button onClick={() => handleRemoteToolClick('placeholder-name')} className="flex flex-col items-center gap-1 p-3 rounded-xl transition-all bg-white text-slate-600 hover:bg-slate-50 border border-slate-200 w-20 shadow-sm">
                <Type className="w-6 h-6" />
                <span className="text-[10px] font-medium text-center">Name</span>
              </button>

              <div className="w-10 border-b border-slate-200 my-2"></div>

              {/* --- CHANGED: Edit People -> Clear All --- */}
              <button onClick={() => setSignatures([])} className="flex flex-col items-center gap-1 p-2 rounded-lg text-slate-400 hover:text-red-500 transition-colors">
                <Eraser className="w-5 h-5" />
                <span className="text-[9px] font-medium text-center">Clear All</span>
              </button>
            </>
          )}
        </aside>

        <main className="flex-1 bg-slate-200/50 overflow-auto relative" onClick={handleBackgroundClick}>
          <div className="min-w-fit min-h-full flex flex-col items-center p-4 md:p-8 pb-40">
            {documentData?.fileUrl && (
              <Document
                file={documentData.fileUrl}
                onLoadSuccess={onDocumentLoadSuccess}
                loading={
                  <div className="w-[85vw] md:w-[600px] aspect-[1/1.41] flex items-center justify-center bg-white text-slate-400 shadow-xl border border-slate-300">
                    <div className="flex flex-col items-center gap-2">
                      <Loader2 className="w-10 h-10 animate-spin text-blue-600" />
                      <span className="text-sm font-medium">Loading Document...</span>
                    </div>
                  </div>
                }
              >
                {numPages && Array.from(new Array(numPages), (_, index) => {
                  const pageNum = index + 1;
                  return (
                    <PageWrapper
                      key={pageNum}
                      pageNumber={pageNum}
                      scale={scale}
                      setRef={(el) => {
                        pageRefs.current[pageNum] = el;
                        if (index === 0) pdfContainerRef.current = el; // Keep generic ref for width
                      }}
                    >
                      {signatures.filter(sig => sig.page === pageNum).map((item) => (
                        <DraggableElement
                          key={item.id}
                          data={item}
                          onUpdate={updateElement}
                          onRemove={removeElement}
                          isSelected={selectedId === item.id}
                          onSelect={handleSelect}
                          getRecipientName={getRecipientName}
                        />
                      ))}
                    </PageWrapper>
                  );
                })}
              </Document>
            )}
          </div>
          {/* Page Controls Removed */}
        </main>
      </div>

      {/* --- MOBILE BOTTOM TOOLBAR --- */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 z-50 px-2 py-2 flex justify-around items-end shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
        {!isRemote ? selfSignTools.map((tool, idx) => (
          <button key={idx} onClick={tool.action} className="flex flex-col items-center gap-1 p-2 rounded-lg transition-all text-slate-500 hover:text-slate-800 flex-1 min-w-[50px]">
            {tool.icon} <span className="text-[10px] font-medium text-center leading-tight">{tool.label}</span>
          </button>
        )) : (
          /* --- REMOTE MOBILE TOOLS --- */
          <>
            <button onClick={() => handleRemoteToolClick('placeholder')} className="flex flex-col items-center gap-1 p-2 rounded-lg transition-all text-yellow-600 hover:text-yellow-800 flex-1 min-w-[50px]">
              <PlusSquare className="w-5 h-5" /> <span className="text-[10px] font-medium text-center leading-tight">Sign Box</span>
            </button>
            <button onClick={() => handleRemoteToolClick('placeholder-date')} className="flex flex-col items-center gap-1 p-2 rounded-lg transition-all text-slate-500 hover:text-slate-800 flex-1 min-w-[50px]">
              <Calendar className="w-5 h-5" /> <span className="text-[10px] font-medium text-center leading-tight">Date Box</span>
            </button>
            <button onClick={() => handleRemoteToolClick('placeholder-name')} className="flex flex-col items-center gap-1 p-2 rounded-lg transition-all text-slate-500 hover:text-slate-800 flex-1 min-w-[50px]">
              <Type className="w-5 h-5" /> <span className="text-[10px] font-medium text-center leading-tight">Name Box</span>
            </button>
            <button onClick={() => setSignatures([])} className="flex flex-col items-center gap-1 p-2 rounded-lg transition-all text-red-500 hover:text-red-700 flex-1 min-w-[50px]">
              <Eraser className="w-5 h-5" /> <span className="text-[10px] font-medium text-center leading-tight">Clear</span>
            </button>
          </>
        )}
      </div>

      <SignatureModal isOpen={isSigModalOpen} onClose={() => setIsSigModalOpen(false)} onSave={handleSaveSignature} />
      <RecipientModal isOpen={isRecipientModalOpen} onClose={() => setIsRecipientModalOpen(false)} onAdd={handleAddRecipient} />

      {/* Assign Recipient Modal */}
      <AssignRecipientModal
        isOpen={isAssignModalOpen}
        onClose={() => setIsAssignModalOpen(false)}
        recipients={recipients}
        onAssign={handleAssignRecipient}
      />

      <FinishModal
        isOpen={isFinishModalOpen}
        onClose={() => setIsFinishModalOpen(false)}
        onDownload={handleDownload}
        onEmail={handleEmail}
        processing={processing}
        initialMode={recipients.length > 0 ? 'email_only' : 'select'}
      />
    </div>
  );
};

export default Editor;