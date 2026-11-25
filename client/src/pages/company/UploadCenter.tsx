import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  UploadCloud,
  FileImage,
  FileText,
  X,
  CheckCircle2,
  AlertCircle,
  FolderKanban,
  Tag,
  ArrowRight,
  Stamp,
  Images,
  Cloud,
  ExternalLink,
  Copy,
  Check,
  Loader2,
  Sparkles,
  Video,
  Film,
} from 'lucide-react';
import { designsApi, projectsApi, uploadApi } from '../../api/index.js';
import { Project } from '../../types/index.js';
import { Card, Button, Badge } from '../../components/common/index.js';
import { useAuthStore } from '../../store/authStore.js';

export const UploadCenter: React.FC = () => {
  const { role, permissions } = useAuthStore();
  const navigate = useNavigate();

  const canUpload = role === 'Company' || (role === 'Designer' && permissions?.canUpload !== false);

  const [activeTab, setActiveTab] = useState<'images' | 'documents'>('images');
  const [files, setFiles] = useState<File[]>([]);
  const [documentFiles, setDocumentFiles] = useState<File[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [skuPrefix, setSkuPrefix] = useState('');
  const [tags, setTags] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState('');
  const [uploadLoaded, setUploadLoaded] = useState(0);
  const [uploadTotal, setUploadTotal] = useState(0);
  const [result, setResult] = useState<{ success: boolean; count: number; message?: string } | null>(null);
  const [uploadedDocuments, setUploadedDocuments] = useState<any[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!canUpload) return;
    projectsApi.list().then((res) => setProjects(res.data.data || []));
  }, [canUpload]);

  if (!canUpload) {
    return (
      <div className="max-w-2xl mx-auto py-16 text-center space-y-4">
        <div className="w-12 h-12 mx-auto rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-bold text-[#1E293B] font-heading">Upload Restricted</h2>
        <p className="text-xs text-[#64748B]">
          Your account does not have permission to upload jewellery images or master assets.
        </p>
        <Button variant="outline" size="sm" onClick={() => navigate(-1)}>
          Go Back
        </Button>
      </div>
    );
  }

  const handleFilesSelected = (newFiles: FileList | null) => {
    if (!newFiles) return;
    const validImageTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
    const validVideoTypes = ['video/mp4', 'video/quicktime', 'video/webm', 'video/x-matroska', 'video/avi'];
    const validFiles: File[] = [];

    for (let i = 0; i < newFiles.length; i++) {
      const file = newFiles[i];
      const isVideoExt = /\.(mp4|mov|webm|mkv|avi)$/i.test(file.name);
      if (
        validImageTypes.includes(file.type.toLowerCase()) ||
        validVideoTypes.includes(file.type.toLowerCase()) ||
        (file.type.startsWith('video/') && isVideoExt) ||
        isVideoExt
      ) {
        validFiles.push(file);
      } else {
        alert(`File ${file.name} is not supported. Supported: JPEG, PNG, WebP, MP4, MOV, WebM.`);
      }
    }

    setFiles((prev) => [...prev, ...validFiles]);
  };

  const handleDocumentsSelected = (newFiles: FileList | null) => {
    if (!newFiles) return;
    const validFiles: File[] = [];

    for (let i = 0; i < newFiles.length; i++) {
      validFiles.push(newFiles[i]);
    }

    setDocumentFiles((prev) => [...prev, ...validFiles]);
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const removeDocFile = (index: number) => {
    setDocumentFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (files.length === 0) return;

    setUploading(true);
    setUploadProgress(0);
    setUploadLoaded(0);
    const totalBytes = files.reduce((acc, f) => acc + f.size, 0);
    setUploadTotal(totalBytes);
    setUploadStatus(`Preparing ${files.length} jewellery master photo${files.length > 1 ? 's' : ''}...`);
    setResult(null);

    const formData = new FormData();
    files.forEach((file) => formData.append('images', file));
    if (selectedProjectId) formData.append('projectId', selectedProjectId);
    if (skuPrefix) formData.append('skuPrefix', skuPrefix.trim());
    if (tags) formData.append('tags', tags);

    let progressTimer: ReturnType<typeof setInterval> | null = null;
    const startProcessingTicker = () => {
      if (progressTimer) return;
      progressTimer = setInterval(() => {
        setUploadProgress((prev) => {
          if (prev >= 98) {
            return 98;
          }
          const next = prev + 1;
          if (next >= 96) {
            setUploadStatus('Finalizing catalogue indexing & encryption...');
          } else if (next >= 93) {
            setUploadStatus('Optimizing thumbnails & extracting colour data...');
          } else {
            setUploadStatus('Securing master images & indexing catalogue metadata...');
          }
          return next;
        });
      }, 250);
    };

    try {
      const res = await designsApi.upload(formData, (progressEvent: any) => {
        if (progressEvent.total) {
          const loaded = progressEvent.loaded || 0;
          const total = progressEvent.total || totalBytes;
          setUploadLoaded(loaded);
          setUploadTotal(total);

          const networkPercent = Math.min(100, Math.round((loaded * 100) / total));

          if (networkPercent < 100) {
            // Smoothly scale bytes transfer between 5% and 88%
            const scaled = Math.max(5, Math.min(88, Math.round((loaded * 88) / total)));
            setUploadProgress(scaled);
            const mbLoaded = (loaded / (1024 * 1024)).toFixed(1);
            const mbTotal = (total / (1024 * 1024)).toFixed(1);
            setUploadStatus(`Uploading: ${mbLoaded} MB / ${mbTotal} MB (${networkPercent}%)`);
          } else {
            // 100% bytes transferred to server, actively processing Cloudinary & Sharp indexing
            setUploadLoaded(total);
            setUploadProgress((prev) => Math.max(prev, 89));
            setUploadStatus('Securing master images & indexing catalogue metadata...');
            startProcessingTicker();
          }
        }
      });

      if (progressTimer) clearInterval(progressTimer);
      setUploadProgress(100);
      setUploadStatus('Upload & indexing complete!');
      setResult({
        success: true,
        count: res.data.data.length,
      });
      setFiles([]);
      setSkuPrefix('');
      setTags('');
    } catch (err: any) {
      if (progressTimer) clearInterval(progressTimer);
      setResult({
        success: false,
        count: 0,
        message: err.response?.data?.message || 'Upload failed.',
      });
    } finally {
      if (progressTimer) clearInterval(progressTimer);
      setTimeout(() => {
        setUploading(false);
      }, 700);
    }
  };

  const handleDocumentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (documentFiles.length === 0) return;

    setUploading(true);
    setUploadProgress(0);
    setUploadLoaded(0);
    const totalBytes = documentFiles.reduce((acc, f) => acc + f.size, 0);
    setUploadTotal(totalBytes);
    setUploadStatus(`Preparing ${documentFiles.length} certificate document${documentFiles.length > 1 ? 's' : ''}...`);

    const formData = new FormData();
    documentFiles.forEach((doc) => formData.append('documents', doc));

    let docProgressTimer: ReturnType<typeof setInterval> | null = null;
    const startDocTicker = () => {
      if (docProgressTimer) return;
      docProgressTimer = setInterval(() => {
        setUploadProgress((prev) => {
          if (prev >= 98) return 98;
          const next = prev + 1;
          if (next >= 95) {
            setUploadStatus('Finalizing document encryption & metadata indexing...');
          } else {
            setUploadStatus('Storing documents in secure vault...');
          }
          return next;
        });
      }, 250);
    };

    try {
      const res = await uploadApi.uploadDocument(formData, (progressEvent: any) => {
        if (progressEvent.total) {
          const loaded = progressEvent.loaded || 0;
          const total = progressEvent.total || totalBytes;
          setUploadLoaded(loaded);
          setUploadTotal(total);

          const networkPercent = Math.min(100, Math.round((loaded * 100) / total));

          if (networkPercent < 100) {
            const scaled = Math.max(5, Math.min(88, Math.round((loaded * 88) / total)));
            setUploadProgress(scaled);
            const kbLoaded = (loaded / 1024).toFixed(0);
            const kbTotal = (total / 1024).toFixed(0);
            setUploadStatus(`Uploading: ${kbLoaded} KB / ${kbTotal} KB (${networkPercent}%)`);
          } else {
            setUploadLoaded(total);
            setUploadProgress((prev) => Math.max(prev, 89));
            setUploadStatus('Storing documents in secure vault...');
            startDocTicker();
          }
        }
      });

      if (docProgressTimer) clearInterval(docProgressTimer);
      setUploadProgress(100);
      setUploadStatus('Document upload complete!');
      setUploadedDocuments((prev) => [...res.data.data, ...prev]);
      setDocumentFiles([]);
    } catch (err: any) {
      if (docProgressTimer) clearInterval(docProgressTimer);
      alert(err.response?.data?.message || 'Document upload failed.');
    } finally {
      if (docProgressTimer) clearInterval(docProgressTimer);
      setTimeout(() => {
        setUploading(false);
      }, 700);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#1E293B] font-heading">Upload Center</h1>
          <p className="text-xs text-[#64748B] mt-0.5">
            Upload jewellery master photos, CAD renders, certificates, and hallmarking documents.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[#E2E8F0] gap-4 sm:gap-6 overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveTab('images')}
          className={`pb-3 text-xs font-bold font-heading border-b-2 transition flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'images'
              ? 'border-[#7C3AED] text-[#7C3AED]'
              : 'border-transparent text-[#64748B] hover:text-[#1E293B]'
          }`}
        >
          <FileImage className="w-4 h-4 flex-shrink-0" />
          <span className="hidden sm:inline">Jewellery Photography</span>
          <span className="sm:hidden">Photos</span> ({files.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('documents')}
          className={`pb-3 text-xs font-bold font-heading border-b-2 transition flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'documents'
              ? 'border-[#7C3AED] text-[#7C3AED]'
              : 'border-transparent text-[#64748B] hover:text-[#1E293B]'
          }`}
        >
          <FileText className="w-4 h-4 flex-shrink-0" />
          <span className="hidden sm:inline">Certificates & Documents</span>
          <span className="sm:hidden">Documents</span> ({documentFiles.length})
        </button>
      </div>

      {activeTab === 'images' ? (
        <>
          {result && result.success && (
            <Card className="bg-[#16A34A]/10 border-[#16A34A]/25 p-5">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-6 h-6 text-[#16A34A] flex-shrink-0" />
                  <div>
                    <h4 className="text-sm font-bold text-[#1E293B] font-heading">
                      Upload Complete! ({result.count} Images Added)
                    </h4>
                    <p className="text-xs text-[#64748B] mt-0.5">
                      Images have been securely decoded and saved to your jewellery catalogue.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => navigate(role === 'Company' ? '/company/gallery' : '/designer/gallery')}
                  >
                    <Images className="w-3.5 h-3.5 mr-1" /> View Gallery
                  </Button>
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={() => navigate(role === 'Company' ? '/company/editor' : '/designer/editor')}
                  >
                    <Stamp className="w-3.5 h-3.5 mr-1" /> Open Watermark Studio
                  </Button>
                </div>
              </div>
            </Card>
          )}

          {result && !result.success && (
            <div className="p-3.5 rounded-xl bg-[#DC2626]/10 border border-[#DC2626]/20 flex items-center gap-2 text-xs text-[#DC2626]">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{result.message}</span>
            </div>
          )}

          <form onSubmit={handleUploadSubmit} className="space-y-6">
            {/* Drag & Drop Area */}
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                handleFilesSelected(e.dataTransfer.files);
              }}
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-[#CBD5E1] hover:border-[#7C3AED] bg-white rounded-2xl p-10 text-center cursor-pointer transition flex flex-col items-center justify-center group"
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm"
                onChange={(e) => handleFilesSelected(e.target.files)}
                className="hidden"
              />
              <div className="w-14 h-14 rounded-2xl bg-[#7C3AED]/10 text-[#7C3AED] flex items-center justify-center mb-3 group-hover:scale-110 transition">
                <UploadCloud className="w-7 h-7" />
              </div>
              <h3 className="text-sm font-bold text-[#1E293B] font-heading">
                Drag & drop jewellery images & videos here, or{' '}
                <span className="text-[#7C3AED] underline">browse files</span>
              </h3>
              <p className="text-xs text-[#64748B] mt-1">
                Supports JPEG, PNG, WebP photos & MP4, MOV, WebM showcase videos (up to 150MB each, max 50 items per batch)
              </p>
            </div>

            {/* Selected Files Staging Preview */}
            {files.length > 0 && (
              <Card className="space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-[#E2E8F0]">
                  <span className="text-xs font-bold text-[#1E293B] font-heading">
                    Selected Media Items ({files.length})
                  </span>
                  <button
                    type="button"
                    onClick={() => setFiles([])}
                    className="text-xs text-[#DC2626] hover:underline"
                  >
                    Clear All
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3 max-h-60 overflow-y-auto p-1">
                  {files.map((file, idx) => {
                    const isVideo = file.type.startsWith('video/') || /\.(mp4|mov|webm|mkv|avi)$/i.test(file.name);
                    return (
                      <div
                        key={idx}
                        className="relative group rounded-lg border border-[#E2E8F0] p-2 bg-[#F8FAFC] flex flex-col items-center text-center"
                      >
                        {isVideo ? (
                          <div className="relative mb-1">
                            <Video className="w-8 h-8 text-[#7C3AED]" />
                            <span className="absolute -bottom-1 -right-2 text-[9px] font-bold bg-[#7C3AED] text-white px-1 py-0.2 rounded">
                              VIDEO
                            </span>
                          </div>
                        ) : (
                          <FileImage className="w-8 h-8 text-[#7C3AED] mb-1" />
                        )}
                        <span className="text-[11px] font-semibold text-[#1E293B] truncate w-full mt-1">
                          {file.name}
                        </span>
                        <span className="text-[10px] text-[#64748B]">
                          {(file.size / (1024 * 1024) >= 1)
                            ? `${(file.size / (1024 * 1024)).toFixed(1)} MB`
                            : `${(file.size / 1024).toFixed(0)} KB`}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeFile(idx)}
                          className="absolute -top-1.5 -right-1.5 p-1 rounded-full bg-[#DC2626] text-white opacity-0 group-hover:opacity-100 transition shadow-sm"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </Card>
            )}

            {/* Batch Metadata Settings */}
            <Card className="space-y-4">
              <h3 className="text-sm font-bold text-[#1E293B] font-heading">
                Collection & Product Indexing (Optional)
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[#1E293B] font-heading mb-1">
                    Assign to Collection
                  </label>
                  <select
                    value={selectedProjectId}
                    onChange={(e) => setSelectedProjectId(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-[#E2E8F0] rounded-lg bg-white font-medium focus:outline-none focus:border-[#7C3AED]"
                  >
                    <option value="">No Collection (Unassigned)</option>
                    {projects.map((p) => (
                      <option key={p._id} value={p._id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#1E293B] font-heading mb-1">
                    SKU Prefix Generator
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. SOL-RNG-2026"
                    value={skuPrefix}
                    onChange={(e) => setSkuPrefix(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-[#E2E8F0] rounded-lg focus:outline-none focus:border-[#7C3AED]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#1E293B] font-heading mb-1">
                    Tags (Comma separated)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 18k, diamond, export"
                    value={tags}
                    onChange={(e) => setTags(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-[#E2E8F0] rounded-lg focus:outline-none focus:border-[#7C3AED]"
                  />
                </div>
              </div>

              {uploading && (
                <div className="space-y-2 pt-3 pb-1 p-3.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] shadow-2xs">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 font-semibold text-[#1E293B] min-w-0">
                      <Loader2 className="w-3.5 h-3.5 text-[#7C3AED] animate-spin shrink-0" />
                      <span className="truncate">{uploadStatus || 'Uploading jewellery images...'}</span>
                    </div>
                    <span className="font-mono font-bold text-xs text-[#7C3AED] px-2 py-0.5 rounded-full bg-[#7C3AED]/10 border border-[#7C3AED]/20 shrink-0">
                      {uploadProgress}%
                    </span>
                  </div>

                  {/* Dynamic Animated Progress Bar with Candy-Stripes and Shimmer */}
                  <div className="w-full bg-[#E2E8F0] rounded-full h-3 overflow-hidden p-0.5 shadow-inner relative">
                    <div
                      className="bg-gradient-to-r from-[#7C3AED] via-[#9061F9] to-[#7C3AED] h-full rounded-full transition-all duration-300 ease-out relative overflow-hidden animate-stripes shadow-xs"
                      style={{ width: `${Math.max(5, uploadProgress)}%` }}
                    >
                      {/* Moving light sweep highlight */}
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent animate-shimmer-sweep" />
                    </div>
                  </div>

                  {/* Subtext live transfer info */}
                  <div className="flex items-center justify-between text-[11px] text-[#64748B]">
                    <span>
                      {uploadTotal > 0
                        ? `${(uploadLoaded / (1024 * 1024)).toFixed(1)} MB of ${(uploadTotal / (1024 * 1024)).toFixed(1)} MB transferred`
                        : `${files.length} master files queued`}
                    </span>
                    <span className="text-[#7C3AED] font-medium">
                      {uploadProgress >= 89 && uploadProgress < 100
                        ? 'Processing on server...'
                        : uploadProgress === 100
                        ? 'Done!'
                        : 'Live transfer'}
                    </span>
                  </div>
                </div>
              )}

              <div className="pt-2 flex justify-end">
                <Button
                  type="submit"
                  disabled={files.length === 0 || uploading}
                  variant="primary"
                  size="md"
                >
                  <UploadCloud className="w-4 h-4 mr-1.5" />
                  {uploading ? 'Processing Upload...' : `Upload ${files.length} Jewellery Images`}
                </Button>
              </div>
            </Card>
          </form>
        </>
      ) : (
        /* Documents Tab */
        <div className="space-y-6">
          <form onSubmit={handleDocumentSubmit} className="space-y-6">
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                handleDocumentsSelected(e.dataTransfer.files);
              }}
              onClick={() => docInputRef.current?.click()}
              className="border-2 border-dashed border-[#CBD5E1] hover:border-[#7C3AED] bg-white rounded-2xl p-10 text-center cursor-pointer transition flex flex-col items-center justify-center group"
            >
              <input
                ref={docInputRef}
                type="file"
                multiple
                accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt"
                onChange={(e) => handleDocumentsSelected(e.target.files)}
                className="hidden"
              />
              <div className="w-14 h-14 rounded-2xl bg-[#B8860B]/10 text-[#B8860B] flex items-center justify-center mb-3 group-hover:scale-110 transition">
                <FileText className="w-7 h-7" />
              </div>
              <h3 className="text-sm font-bold text-[#1E293B] font-heading">
                Upload Jewellery Certificates & Documentation
              </h3>
              <p className="text-xs text-[#64748B] mt-1">
                Supports PDF, Word, Excel, CSV, and Text files (GIA/IGI certificates, valuation reports, export manifests)
              </p>
            </div>

            {documentFiles.length > 0 && (
              <Card className="space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-[#E2E8F0]">
                  <span className="text-xs font-bold text-[#1E293B] font-heading">
                    Staged Documents ({documentFiles.length})
                  </span>
                  <button
                    type="button"
                    onClick={() => setDocumentFiles([])}
                    className="text-xs text-[#DC2626] hover:underline"
                  >
                    Clear All
                  </button>
                </div>

                <div className="space-y-2">
                  {documentFiles.map((doc, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-2.5 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC]"
                    >
                      <div className="flex items-center gap-2.5 truncate">
                        <FileText className="w-5 h-5 text-[#B8860B] flex-shrink-0" />
                        <span className="text-xs font-semibold text-[#1E293B] truncate">{doc.name}</span>
                        <span className="text-[10px] text-[#64748B]">({(doc.size / 1024).toFixed(0)} KB)</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeDocFile(idx)}
                        className="text-[#DC2626] hover:text-[#B91C1C] p-1"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>

                {uploading && (
                  <div className="space-y-2 pt-3 pb-1 p-3.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] shadow-2xs">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 font-semibold text-[#1E293B] min-w-0">
                        <Loader2 className="w-3.5 h-3.5 text-[#7C3AED] animate-spin shrink-0" />
                        <span className="truncate">{uploadStatus || 'Uploading documents...'}</span>
                      </div>
                      <span className="font-mono font-bold text-xs text-[#7C3AED] px-2 py-0.5 rounded-full bg-[#7C3AED]/10 border border-[#7C3AED]/20 shrink-0">
                        {uploadProgress}%
                      </span>
                    </div>

                    <div className="w-full bg-[#E2E8F0] rounded-full h-3 overflow-hidden p-0.5 shadow-inner relative">
                      <div
                        className="bg-gradient-to-r from-[#7C3AED] via-[#9061F9] to-[#7C3AED] h-full rounded-full transition-all duration-200 ease-out relative overflow-hidden animate-stripes shadow-xs"
                        style={{ width: `${Math.max(5, uploadProgress)}%` }}
                      >
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent animate-shimmer-sweep" />
                      </div>
                    </div>

                    {/* Subtext live transfer info */}
                    <div className="flex items-center justify-between text-[11px] text-[#64748B]">
                      <span>
                        {uploadTotal > 0
                          ? `${(uploadLoaded / 1024).toFixed(0)} KB of ${(uploadTotal / 1024).toFixed(0)} KB transferred`
                          : `${documentFiles.length} files queued`}
                      </span>
                      <span className="text-[#7C3AED] font-medium">
                        {uploadProgress >= 89 && uploadProgress < 100
                          ? 'Processing on server...'
                          : uploadProgress === 100
                          ? 'Done!'
                          : 'Live transfer'}
                      </span>
                    </div>
                  </div>
                )}

                <div className="pt-2 flex justify-end">
                  <Button
                    type="submit"
                    disabled={uploading}
                    variant="primary"
                    size="md"
                  >
                    <UploadCloud className="w-4 h-4 mr-1.5" />
                    {uploading ? 'Uploading document(s)...' : `Upload ${documentFiles.length} Document(s)`}
                  </Button>
                </div>
              </Card>
            )}
          </form>

          {/* Uploaded Documents List */}
          {uploadedDocuments.length > 0 && (
            <Card className="space-y-3">
              <h3 className="text-xs font-bold text-[#1E293B] font-heading">
                Recently Uploaded Documents ({uploadedDocuments.length})
              </h3>
              <div className="space-y-2">
                {uploadedDocuments.map((doc) => (
                  <div
                    key={doc.id}
                    className="flex items-center justify-between p-3 rounded-xl border border-[#E2E8F0] bg-white hover:border-[#7C3AED]/40 transition"
                  >
                    <div className="flex items-center gap-3 truncate">
                      <FileText className="w-5 h-5 text-[#7C3AED] flex-shrink-0" />
                      <div className="truncate">
                        <div className="text-xs font-semibold text-[#1E293B] truncate">{doc.filename}</div>
                        <div className="text-[10px] text-[#64748B]">
                          {(doc.fileSize / 1024).toFixed(0)} KB • {doc.mimeType}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => copyToClipboard(doc.url, doc.id)}
                      >
                        {copiedId === doc.id ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-[#16A34A] mr-1" /> Copied
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5 mr-1" /> Copy Link
                          </>
                        )}
                      </Button>
                      <a
                        href={doc.url}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1.5 rounded-lg border border-[#E2E8F0] text-[#64748B] hover:text-[#7C3AED] hover:border-[#7C3AED] transition"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      )}
    </div>
  );
};
