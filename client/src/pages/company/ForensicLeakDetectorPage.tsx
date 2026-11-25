import React, { useState } from 'react';
import {
  ShieldAlert,
  UploadCloud,
  CheckCircle2,
  AlertTriangle,
  User,
  Calendar,
  Building,
  FileCheck,
  KeyRound,
  RotateCcw,
  Search,
  Sparkles,
  FileSearch,
  Lock,
} from 'lucide-react';
import { Card, Button, Badge } from '../../components/common/index.js';
import { forensicsApi } from '../../api/index.js';

interface LeakReportData {
  detected: boolean;
  status: 'AUTHENTIC_LEAK' | 'TAMPERED' | 'NOT_DETECTED';
  confidenceScore: number;
  originWorkspace?: string;
  companyId?: string;
  leakedBy?: string;
  actorId?: string;
  designFilename?: string;
  sku?: string;
  exportedAt?: string;
  rawTimestamp?: number;
  cryptographicSignature?: string;
  isSignatureValid?: boolean;
}

export const ForensicLeakDetectorPage: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [scanning, setScanning] = useState<boolean>(false);
  const [scanResult, setScanResult] = useState<{
    report: LeakReportData;
    design?: any;
    scannedAt?: string;
    analyzedFileSize?: number;
  } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      setFilePreview(URL.createObjectURL(file));
      setScanResult(null);
      setErrorMsg(null);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      setSelectedFile(file);
      setFilePreview(URL.createObjectURL(file));
      setScanResult(null);
      setErrorMsg(null);
    }
  };

  const handleScanFile = async () => {
    if (!selectedFile) return;
    setScanning(true);
    setErrorMsg(null);

    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
      const res = await forensicsApi.detectLeak(formData);
      setScanResult(res.data.data);
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || 'Forensic analysis failed. Please try again.');
    } finally {
      setScanning(false);
    }
  };

  const handleReset = () => {
    setSelectedFile(null);
    setFilePreview(null);
    setScanResult(null);
    setErrorMsg(null);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-white via-white to-purple-50 rounded-2xl border border-[#E2E8F0] p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-[#7C3AED] font-heading mb-1">
            <ShieldAlert className="w-4 h-4 text-[#7C3AED]" />
            <span>Digital Steganography & Piracy Defense</span>
          </div>
          <h1 className="text-2xl font-bold text-[#1E293B] font-heading tracking-tight">
            Forensic Leak Detector
          </h1>
          <p className="text-xs text-[#64748B] mt-1 max-w-2xl leading-relaxed">
            Drop any suspicious leaked jewellery photo, social media post, or cropped screenshot to extract the hidden cryptographic digital fingerprint and trace exactly who leaked it.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Badge variant="primary" size="md">
            HMAC-SHA256 Active
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Upload Dropzone & Media Preview */}
        <div className="lg:col-span-6 space-y-4">
          <Card className="p-5 border-[#E2E8F0]">
            <h3 className="text-sm font-bold text-[#1E293B] font-heading mb-3 flex items-center gap-2">
              <FileSearch className="w-4 h-4 text-[#7C3AED]" />
              <span>Suspicious Media Input</span>
            </h3>

            {!filePreview ? (
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                className="border-2 border-dashed border-[#CBD5E1] hover:border-[#7C3AED] rounded-2xl p-8 text-center transition bg-[#F8FAFC]/50 hover:bg-[#F8FAFC] cursor-pointer"
              >
                <input
                  type="file"
                  id="forensic-file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <label htmlFor="forensic-file" className="cursor-pointer space-y-3 block">
                  <div className="w-14 h-14 rounded-2xl bg-[#7C3AED]/10 text-[#7C3AED] flex items-center justify-center mx-auto shadow-xs">
                    <UploadCloud className="w-7 h-7" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-[#1E293B] hover:text-[#7C3AED]">
                      Click to upload suspicious file
                    </span>
                    <span className="text-xs text-[#64748B]"> or drag and drop</span>
                  </div>
                  <p className="text-[11px] text-[#94A3B8]">
                    Supports JPEG, PNG, WebP screenshots or downloads
                  </p>
                </label>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="relative aspect-video max-h-[300px] bg-slate-900 rounded-xl overflow-hidden border border-[#E2E8F0] flex items-center justify-center">
                  <img
                    src={filePreview}
                    alt="Upload Preview"
                    className="w-full h-full object-contain"
                  />
                  {scanning && (
                    <div className="absolute inset-0 bg-purple-950/60 backdrop-blur-xs flex flex-col items-center justify-center text-white space-y-2">
                      <div className="w-8 h-8 border-3 border-white border-t-transparent rounded-full animate-spin" />
                      <span className="text-xs font-mono font-semibold tracking-wider animate-pulse">
                        SCANNING DIGITAL PIXELS...
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between text-xs pt-1">
                  <div className="truncate max-w-[240px]">
                    <span className="font-semibold text-[#1E293B] block truncate">
                      {selectedFile?.name}
                    </span>
                    <span className="text-[11px] text-[#64748B] font-mono">
                      {selectedFile ? `${(selectedFile.size / 1024).toFixed(1)} KB` : ''}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={handleReset} disabled={scanning}>
                      <RotateCcw className="w-3.5 h-3.5 mr-1" /> Change File
                    </Button>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={handleScanFile}
                      disabled={scanning}
                      className="bg-[#7C3AED] hover:bg-[#6D28D9] text-white font-semibold"
                    >
                      <Search className="w-3.5 h-3.5 mr-1" />
                      {scanning ? 'Analyzing...' : 'Scan Fingerprint'}
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {errorMsg && (
              <div className="mt-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2 font-medium">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{errorMsg}</span>
              </div>
            )}
          </Card>
        </div>

        {/* Right Column: Forensic Analysis Report */}
        <div className="lg:col-span-6 space-y-4">
          <Card className="p-5 border-[#E2E8F0] h-full flex flex-col justify-between">
            <div>
              <h3 className="text-sm font-bold text-[#1E293B] font-heading mb-3 flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-[#7C3AED]" />
                <span>Forensic Investigation Audit</span>
              </h3>

              {!scanResult ? (
                <div className="py-16 text-center space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                    <Lock className="w-6 h-6" />
                  </div>
                  <h4 className="text-xs font-bold text-[#1E293B]">Awaiting Media Scan</h4>
                  <p className="text-[11px] text-[#64748B] max-w-xs mx-auto leading-relaxed">
                    Upload an image on the left and click "Scan Fingerprint" to decrypt hidden pixel steganography and reveal origin metadata.
                  </p>
                </div>
              ) : scanResult.report.detected ? (
                <div className="space-y-4 animate-in fade-in duration-200">
                  {/* Alert Banner */}
                  <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-rose-500 text-white flex items-center justify-center shrink-0 shadow-md">
                      <AlertTriangle className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-rose-800 uppercase tracking-wide">
                        🚨 LEAK SOURCE POSITIVELY IDENTIFIED
                      </div>
                      <div className="text-[11px] text-rose-700 font-medium">
                        Invisible digital fingerprint detected with {scanResult.report.confidenceScore}% confidence.
                      </div>
                    </div>
                  </div>

                  {/* Findings Breakdown Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div className="p-3 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-1">
                      <div className="flex items-center gap-1.5 text-[11px] text-[#64748B]">
                        <User className="w-3.5 h-3.5 text-[#7C3AED]" />
                        <span>Downloader / Leaked By</span>
                      </div>
                      <div className="font-bold text-[#1E293B] font-mono text-xs truncate">
                        {scanResult.report.leakedBy || 'Unknown User'}
                      </div>
                    </div>

                    <div className="p-3 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-1">
                      <div className="flex items-center gap-1.5 text-[11px] text-[#64748B]">
                        <Building className="w-3.5 h-3.5 text-[#B8860B]" />
                        <span>Origin Workspace</span>
                      </div>
                      <div className="font-bold text-[#1E293B] text-xs truncate">
                        {scanResult.report.originWorkspace || 'Active Company'}
                      </div>
                    </div>

                    <div className="p-3 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-1">
                      <div className="flex items-center gap-1.5 text-[11px] text-[#64748B]">
                        <Calendar className="w-3.5 h-3.5 text-blue-500" />
                        <span>Exported Timestamp</span>
                      </div>
                      <div className="font-semibold text-[#1E293B] font-mono text-[11px]">
                        {scanResult.report.exportedAt || 'N/A'}
                      </div>
                    </div>

                    <div className="p-3 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-1">
                      <div className="flex items-center gap-1.5 text-[11px] text-[#64748B]">
                        <FileCheck className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Original Catalogue SKU</span>
                      </div>
                      <div className="font-bold text-[#7C3AED] font-mono text-xs">
                        {scanResult.report.sku || scanResult.design?.sku || 'SKU-IDENTIFIED'}
                      </div>
                    </div>
                  </div>

                  {/* Cryptographic Proof Card */}
                  <div className="p-3 rounded-xl bg-purple-50/50 border border-purple-200/60 text-xs space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-[#7C3AED] flex items-center gap-1">
                        <KeyRound className="w-3.5 h-3.5" />
                        Cryptographic HMAC Hash
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                        {scanResult.report.isSignatureValid ? '✓ SIGNATURE VERIFIED' : 'TAMPERED'}
                      </span>
                    </div>
                    <div className="font-mono text-[10px] text-slate-600 break-all bg-white p-2 rounded-lg border border-purple-100">
                      {scanResult.report.cryptographicSignature || 'SHA256:VERIFIED_AUTHENTIC'}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="py-12 text-center space-y-2.5">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <h4 className="text-xs font-bold text-[#1E293B]">
                    No Forensic Signature Detected
                  </h4>
                  <p className="text-[11px] text-[#64748B] max-w-xs mx-auto leading-relaxed">
                    This file does not contain an AurumMark digital forensic watermark, or the signature was stripped by external re-encoding.
                  </p>
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-[#E2E8F0] flex items-center justify-between text-[11px] text-[#64748B]">
              <span>AurumMark Steganography v1.0</span>
              <span>Encrypted with Company Salt</span>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

