import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Stamp,
  Type,
  Image as ImageIcon,
  Grid,
  Grid3X3,
  RotateCcw,
  Save,
  CheckCircle2,
  AlertCircle,
  Eye,
  Images,
  Cpu,
  Layers,
  Sparkles,
  Pencil,
  Copy,
  Loader2,
} from 'lucide-react';
import { WatermarkCanvas } from '../../components/editor/WatermarkCanvas.js';
import { TextSettings } from '../../components/editor/TextSettings.js';
import { LogoSettings } from '../../components/editor/LogoSettings.js';
import { TiledSettings } from '../../components/editor/TiledSettings.js';
import { PositionPresets } from '../../components/editor/PositionPresets.js';
import { useWatermarkStore } from '../../store/watermarkStore.js';
import { useAuthStore } from '../../store/authStore.js';
import { designsApi, templatesApi } from '../../api/index.js';
import { Design, WatermarkTemplate } from '../../types/index.js';
import { Card, Button, Modal } from '../../components/common/index.js';

export const WatermarkEditorPage: React.FC = () => {
  const { config, setConfig, referenceImage, setReferenceImage, resetConfig, undo, redo } = useWatermarkStore();
  const { role, permissions } = useAuthStore();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const templateIdParam = searchParams.get('templateId');

  const canAccessEditor =
    role === 'Company' ||
    (role === 'Designer' &&
      (permissions?.canCreateTemplate !== false || permissions?.canEditTemplate !== false));
  const canSaveTemplate =
    role === 'Company' || (role === 'Designer' && permissions?.canCreateTemplate !== false);
  const canProcess =
    role === 'Company' || (role === 'Designer' && permissions?.canProcess !== false);

  const [activeTab, setActiveTab] = useState<'text' | 'logo' | 'tiled' | 'position'>('text');
  const [designs, setDesigns] = useState<Design[]>([]);
  const [loadingDesigns, setLoadingDesigns] = useState(false);

  // Editing Template State
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(templateIdParam);
  const [editingTemplate, setEditingTemplate] = useState<WatermarkTemplate | null>(null);
  const [loadingTemplate, setLoadingTemplate] = useState(false);

  // Save Template Modal
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [templateName, setTemplateName] = useState('Luxury Jewellery Watermark');
  const [templateDesc, setTemplateDesc] = useState('Custom watermark preset');
  const [isDefault, setIsDefault] = useState(false);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState('Template Saved Successfully!');

  // Server parity preview state
  const [serverPreviewUrl, setServerPreviewUrl] = useState<string | null>(null);
  const [verifyingParity, setVerifyingParity] = useState(false);

  // Single image / video watermark state
  const [applyingSingle, setApplyingSingle] = useState(false);
  const [applyToast, setApplyToast] = useState<string | null>(null);

  const currentSelectedDesign = designs.find((d) => {
    const origId = typeof d.originalAssetId === 'string' ? d.originalAssetId : d.originalAssetId?._id;
    return origId === referenceImage?._id;
  });
  const isSelectedVideo =
    currentSelectedDesign?.mediaType === 'video' ||
    referenceImage?.mimeType?.startsWith('video/') ||
    false;

  // Ensure no reference image is selected by default
  useEffect(() => {
    setReferenceImage(null);
  }, [setReferenceImage]);

  useEffect(() => {
    if (!canAccessEditor) return;
    setLoadingDesigns(true);
    designsApi
      .list({ limit: 50 })
      .then((res) => {
        const fetched = res.data.data || [];
        setDesigns(fetched);
      })
      .finally(() => setLoadingDesigns(false));
  }, [canAccessEditor]);

  // Load template by ID if editing
  useEffect(() => {
    if (!templateIdParam) {
      setEditingTemplateId(null);
      setEditingTemplate(null);
      return;
    }
    setLoadingTemplate(true);
    templatesApi
      .getById(templateIdParam)
      .then((res) => {
        const tmpl = res.data.data;
        if (tmpl) {
          setEditingTemplateId(tmpl._id);
          setEditingTemplate(tmpl);
          setTemplateName(tmpl.name);
          setTemplateDesc(tmpl.description || '');
          setIsDefault(Boolean(tmpl.isDefault));
          if (tmpl.configuration) {
            setConfig(tmpl.configuration);
          }
          if (tmpl.watermarkType && ['text', 'logo', 'tiled'].includes(tmpl.watermarkType)) {
            setActiveTab(tmpl.watermarkType as any);
          }
        }
      })
      .catch((err) => {
        console.error('Failed to load template for editing:', err);
      })
      .finally(() => {
        setLoadingTemplate(false);
      });
  }, [templateIdParam]);

  const handleExitEditMode = () => {
    setEditingTemplate(null);
    setEditingTemplateId(null);
    setSearchParams({});
    setTemplateName('Luxury Jewellery Watermark');
    setTemplateDesc('Custom watermark preset');
    setIsDefault(false);
  };

  if (!canAccessEditor) {
    return (
      <div className="max-w-2xl mx-auto py-16 text-center space-y-4">
        <div className="w-12 h-12 mx-auto rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-bold text-[#1E293B] font-heading">Access Restricted</h2>
        <p className="text-xs text-[#64748B]">
          Your account does not have permission to design or modify watermark templates in the studio.
        </p>
        <Button variant="outline" size="sm" onClick={() => navigate(-1)}>
          Go Back
        </Button>
      </div>
    );
  }

  const handleUpdateTemplate = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!editingTemplateId || !templateName.trim()) return;
    setSavingTemplate(true);
    try {
      const res = await templatesApi.update(editingTemplateId, {
        name: templateName.trim(),
        description: templateDesc.trim(),
        watermarkType: config.watermarkType || 'text',
        configuration: config,
        isDefault,
      });

      const updated = res.data.data;
      setEditingTemplate(updated);
      setSuccessMessage(`Template "${updated.name}" updated successfully (v${updated.version})!`);
      setSaveSuccess(true);
      setApplyToast(`✓ Template "${updated.name}" updated to v${updated.version}!`);
      setTimeout(() => {
        setSaveSuccess(false);
        setSaveModalOpen(false);
      }, 1500);
    } catch (err: any) {
      console.error('Update template error:', err);
      alert(err.response?.data?.message || 'Failed to update template.');
    } finally {
      setSavingTemplate(false);
    }
  };

  const handleSaveAsNewCopy = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!templateName.trim()) return;
    setSavingTemplate(true);
    try {
      const newName =
        editingTemplateId && templateName === editingTemplate?.name
          ? `${templateName} (Copy)`
          : templateName.trim();

      const res = await templatesApi.create({
        name: newName,
        description: templateDesc.trim(),
        watermarkType: config.watermarkType || 'text',
        configuration: config,
        isDefault: false,
      });

      const created = res.data.data;
      setSuccessMessage(`New template "${created.name}" created successfully!`);
      setSaveSuccess(true);
      setApplyToast(`✓ New template "${created.name}" saved!`);
      setEditingTemplateId(created._id);
      setEditingTemplate(created);
      setTemplateName(created.name);
      setSearchParams({ templateId: created._id });
      setTimeout(() => {
        setSaveSuccess(false);
        setSaveModalOpen(false);
      }, 1500);
    } catch (err: any) {
      console.error('Save template error:', err);
      alert(err.response?.data?.message || 'Failed to save template.');
    } finally {
      setSavingTemplate(false);
    }
  };

  const handleSaveTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingTemplateId) {
      await handleUpdateTemplate(e);
      return;
    }
    await handleSaveAsNewCopy(e);
  };

  const handleVerifyServerParity = async () => {
    if (!referenceImage) {
      alert('Please select a reference jewellery image first.');
      return;
    }
    setVerifyingParity(true);
    setServerPreviewUrl(null);
    try {
      const res = await templatesApi.preview({
        assetId: referenceImage._id,
        configuration: config,
      });
      setServerPreviewUrl(res.data.data.previewUrl);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Server parity verification failed.');
    } finally {
      setVerifyingParity(false);
    }
  };

  const handleApplyToCurrentImage = async () => {
    if (!referenceImage) {
      alert('Please select a reference jewellery media first.');
      return;
    }
    const currentDesign = designs.find((d) => {
      const origId = typeof d.originalAssetId === 'string' ? d.originalAssetId : d.originalAssetId?._id;
      return origId === referenceImage._id;
    });
    if (!currentDesign) {
      alert('Selected design could not be found.');
      return;
    }

    setApplyingSingle(true);
    try {
      await designsApi.applyWatermark(currentDesign._id, {
        configuration: config,
      });
      const mediaTypeLabel = currentDesign.mediaType === 'video' ? 'video' : 'image';
      setApplyToast(`✓ Watermark successfully applied & saved to ${mediaTypeLabel} "${currentDesign.filename}"!`);
      setTimeout(() => setApplyToast(null), 4000);
      const updatedRes = await designsApi.list({ limit: 50 });
      setDesigns(updatedRes.data.data || []);
    } catch (err: any) {
      console.error('Failed to apply watermark to media:', err);
      alert(err.response?.data?.message || 'Failed to apply watermark to current media.');
    } finally {
      setApplyingSingle(false);
    }
  };

  const handleBulkApply = () => {
    const bulkPath = role === 'Company' ? '/company/processing' : '/designer/processing';
    navigate(bulkPath);
  };

  return (
    <div className="w-full flex-1 flex flex-col min-h-0 space-y-3 sm:space-y-4">
      {/* Studio Top Control Strip */}
      <div className="bg-white p-3 sm:p-4 rounded-xl border border-[#E2E8F0] shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-3 flex-shrink-0">
        {/* Left Section: Studio Identity & Reference Selector */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 min-w-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-[#7C3AED]/10 text-[#7C3AED] flex items-center justify-center flex-shrink-0 border border-[#7C3AED]/20 shadow-xs">
              {editingTemplate ? (
                <Pencil className="w-4 h-4 text-[#7C3AED]" />
              ) : (
                <Stamp className="w-4 h-4 text-[#7C3AED]" />
              )}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-base sm:text-lg font-bold text-[#1E293B] font-heading leading-tight truncate">
                  Interactive Watermark Studio
                </h1>
                {editingTemplate && (
                  <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold bg-[#7C3AED]/10 text-[#7C3AED] border border-[#7C3AED]/20 shadow-2xs">
                    <Pencil className="w-3 h-3 text-[#7C3AED]" />
                    <span className="truncate max-w-[120px] sm:max-w-[170px]">Editing: {editingTemplate.name}</span>
                    <span className="text-[10px] bg-[#7C3AED]/20 text-[#7C3AED] px-1 rounded font-mono">v{editingTemplate.version}</span>
                    <button
                      type="button"
                      onClick={handleExitEditMode}
                      className="ml-1 text-[10px] text-[#64748B] hover:text-[#DC2626] font-normal underline cursor-pointer"
                      title="Exit template editing mode"
                    >
                      Exit
                    </button>
                  </div>
                )}
              </div>
              <p className="text-[11px] text-[#64748B] truncate hidden sm:block">
                {editingTemplate
                  ? `Editing preset "${editingTemplate.name}". You can update it or save as a new copy.`
                  : 'Customize placement on one image — automatically apply to thousands.'}
              </p>
            </div>
          </div>

          {/* Reference Image Selector Pill */}
          <div className="flex items-center gap-2 bg-[#F8FAFC] px-3 py-1.5 rounded-xl border border-[#E2E8F0] flex-shrink-0 self-start sm:self-auto">
            <Images className="w-3.5 h-3.5 text-[#7C3AED] flex-shrink-0" />
            <span className="text-[11px] font-semibold text-[#64748B] whitespace-nowrap">Reference:</span>
            <select
              value={referenceImage?._id || ''}
              onChange={(e) => {
                const val = e.target.value;
                if (!val) {
                  setReferenceImage(null);
                  return;
                }
                const selected = designs.find((d) => {
                  const origId = typeof d.originalAssetId === 'string' ? d.originalAssetId : d.originalAssetId?._id;
                  return origId === val;
                });
                if (selected?.originalAssetId) {
                  setReferenceImage(selected.originalAssetId);
                }
              }}
              className="bg-transparent text-xs font-semibold text-[#1E293B] focus:outline-none cursor-pointer max-w-[150px] sm:max-w-[210px] truncate"
            >
              <option value="">-- No Media Selected --</option>
              {designs.map((d) => {
                const origId = typeof d.originalAssetId === 'string' ? d.originalAssetId : d.originalAssetId?._id;
                const isItemVideo = d.mediaType === 'video';
                return (
                  <option key={d._id} value={origId}>
                    {d.sku ? `${d.sku} - ${d.filename}` : d.filename} {isItemVideo ? '🎬 [VIDEO]' : ''}
                  </option>
                );
              })}
            </select>
          </div>
        </div>

        {/* Right Section: Action Buttons (Clean, aligned, non-ragged) */}
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap justify-start sm:justify-end flex-shrink-0">
          {/* Reset button */}
          <button
            onClick={resetConfig}
            title="Reset to Defaults"
            className="p-2 rounded-lg border border-[#E2E8F0] text-[#64748B] hover:text-[#1E293B] hover:bg-[#F1F5F9] transition flex-shrink-0"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          {/* Verify Parity Button */}
          <Button
            size="sm"
            variant="outline"
            disabled={verifyingParity}
            onClick={handleVerifyServerParity}
            className="whitespace-nowrap"
          >
            <Eye className="w-3.5 h-3.5 mr-1.5 text-[#7C3AED]" />
            <span>{verifyingParity ? 'Rendering...' : 'Server Parity'}</span>
          </Button>

          {/* Apply to Current Single Media Button */}
          {canProcess && (
            <Button
              size="sm"
              variant="primary"
              disabled={applyingSingle || !referenceImage}
              onClick={handleApplyToCurrentImage}
              className="whitespace-nowrap bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-xs"
              title="Apply configured watermark directly to this jewellery item and save"
            >
              <Sparkles className="w-3.5 h-3.5 mr-1.5 text-emerald-200" />
              <span>
                {applyingSingle
                  ? (isSelectedVideo ? 'Processing Video...' : 'Watermarking...')
                  : (isSelectedVideo ? 'Watermark This Video' : 'Watermark This Image')}
              </span>
            </Button>
          )}

          {/* Save / Update Template Button */}
          {canSaveTemplate && (
            <Button
              size="sm"
              variant="gold"
              onClick={() => setSaveModalOpen(true)}
              className="whitespace-nowrap"
            >
              {editingTemplate ? (
                <>
                  <Pencil className="w-3.5 h-3.5 mr-1.5" />
                  <span>Update Template</span>
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5 mr-1.5" />
                  <span>Save Template</span>
                </>
              )}
            </Button>
          )}

          {/* Bulk Apply Button */}
          {canProcess && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleBulkApply}
              className="whitespace-nowrap"
            >
              <Cpu className="w-3.5 h-3.5 mr-1.5 text-[#7C3AED]" />
              <span>Apply to Multiple</span>
            </Button>
          )}
        </div>
      </div>

      {/* Main Studio Viewport: Canvas Left + Controls Right */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-4 min-h-0 overflow-y-auto lg:overflow-hidden">
        {/* Visual Konva Canvas (8 cols on lg, full width on mobile/tablet) */}
        <div className="lg:col-span-8 h-[360px] sm:h-[440px] lg:h-full flex flex-col">
          <WatermarkCanvas designs={designs} />
        </div>

        {/* Customization Controls Sidebar (4 cols on lg, full width on mobile/tablet) */}
        <div className="lg:col-span-4 min-h-[420px] lg:h-full flex flex-col bg-white rounded-xl border border-[#E2E8F0] shadow-sm overflow-hidden">
          {/* Tabs */}
          <div className="grid grid-cols-4 border-b border-[#E2E8F0] bg-[#F8FAFC] p-1 gap-1">
            <button
              onClick={() => setActiveTab('text')}
              className={`py-2 text-[11px] font-semibold rounded-lg flex flex-col items-center gap-1 transition ${
                activeTab === 'text'
                  ? 'bg-white text-[#7C3AED] shadow-xs'
                  : 'text-[#64748B] hover:text-[#1E293B]'
              }`}
            >
              <Type className="w-3.5 h-3.5" />
              Text
            </button>
            <button
              onClick={() => setActiveTab('logo')}
              className={`py-2 text-[11px] font-semibold rounded-lg flex flex-col items-center gap-1 transition ${
                activeTab === 'logo'
                  ? 'bg-white text-[#B8860B] shadow-xs'
                  : 'text-[#64748B] hover:text-[#1E293B]'
              }`}
            >
              <ImageIcon className="w-3.5 h-3.5" />
              Logo
            </button>
            <button
              onClick={() => setActiveTab('tiled')}
              className={`py-2 text-[11px] font-semibold rounded-lg flex flex-col items-center gap-1 transition ${
                activeTab === 'tiled'
                  ? 'bg-white text-[#7C3AED] shadow-xs'
                  : 'text-[#64748B] hover:text-[#1E293B]'
              }`}
            >
              <Grid className="w-3.5 h-3.5" />
              Tiled
            </button>
            <button
              onClick={() => setActiveTab('position')}
              className={`py-2 text-[11px] font-semibold rounded-lg flex flex-col items-center gap-1 transition ${
                activeTab === 'position'
                  ? 'bg-white text-[#7C3AED] shadow-xs'
                  : 'text-[#64748B] hover:text-[#1E293B]'
              }`}
            >
              <Grid3X3 className="w-3.5 h-3.5" />
              Grid
            </button>
          </div>

          {/* Tab Content Panel */}
          <div className="flex-1 p-4 overflow-y-auto">
            {activeTab === 'text' && <TextSettings />}
            {activeTab === 'logo' && <LogoSettings />}
            {activeTab === 'tiled' && <TiledSettings />}
            {activeTab === 'position' && <PositionPresets />}
          </div>
        </div>
      </div>

      {/* Save / Update Template Modal */}
      <Modal
        isOpen={saveModalOpen}
        onClose={() => setSaveModalOpen(false)}
        title={editingTemplateId ? 'Update Watermark Template' : 'Save Watermark Template'}
        description={
          editingTemplateId
            ? `Save changes to template "${editingTemplate?.name || templateName}" (v${editingTemplate?.version || 1}) or save as a new copy.`
            : 'Preserve this configuration as a reusable company preset for bulk watermarking.'
        }
      >
        {saveSuccess ? (
          <div className="py-6 text-center space-y-2">
            <CheckCircle2 className="w-12 h-12 text-[#16A34A] mx-auto animate-bounce" />
            <h4 className="text-base font-bold text-[#1E293B] font-heading">
              {successMessage}
            </h4>
            <p className="text-xs text-[#64748B]">
              You can now apply this watermark configuration to any jewellery collection or batch.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSaveTemplate} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[#1E293B] font-heading mb-1">
                Template Name *
              </label>
              <input
                type="text"
                required
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                placeholder="e.g. Export Catalogue — Bottom Right"
                className="w-full px-3 py-2 text-xs border border-[#E2E8F0] rounded-lg focus:outline-none focus:border-[#7C3AED]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#1E293B] font-heading mb-1">
                Description
              </label>
              <textarea
                rows={2}
                value={templateDesc}
                onChange={(e) => setTemplateDesc(e.target.value)}
                placeholder="e.g. Clean gold copyright watermark for wholesale jewellery sheets"
                className="w-full px-3 py-2 text-xs border border-[#E2E8F0] rounded-lg focus:outline-none focus:border-[#7C3AED]"
              />
            </div>

            {role === 'Company' && (
              <label className="flex items-center gap-2 p-2.5 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] cursor-pointer">
                <input
                  type="checkbox"
                  checked={isDefault}
                  onChange={(e) => setIsDefault(e.target.checked)}
                  className="w-4 h-4 rounded text-[#7C3AED] focus:ring-[#7C3AED] border-[#E2E8F0]"
                />
                <span className="text-xs font-semibold text-[#1E293B]">
                  Set as Company Default Template
                </span>
              </label>
            )}

            <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 border-t border-[#E2E8F0]">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setSaveModalOpen(false)}
                className="order-3 sm:order-1"
              >
                Cancel
              </Button>

              <div className="flex items-center gap-2 order-1 sm:order-2 justify-end">
                {editingTemplateId && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={savingTemplate}
                    onClick={handleSaveAsNewCopy}
                    title="Save current configuration as a separate new template"
                    className="flex items-center gap-1"
                  >
                    <Copy className="w-3.5 h-3.5 text-[#64748B]" />
                    <span>Save as New Copy</span>
                  </Button>
                )}

                <Button
                  type="submit"
                  disabled={savingTemplate}
                  variant="gold"
                  size="sm"
                  className="flex items-center gap-1 font-semibold"
                >
                  {savingTemplate ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  )}
                  <span>
                    {savingTemplate
                      ? 'Saving...'
                      : editingTemplateId
                      ? `Update Template (v${(editingTemplate?.version || 1) + 1})`
                      : 'Save Template'}
                  </span>
                </Button>
              </div>
            </div>
          </form>
        )}
      </Modal>

      {/* Server Parity Inspection Modal */}
      {serverPreviewUrl && (
        <Modal
          isOpen={!!serverPreviewUrl}
          onClose={() => setServerPreviewUrl(null)}
          title="Server-Side Sharp Parity Verification"
          description="Rendered by the exact server Sharp engine using Outfit & Poppins TTF fonts."
          maxWidth="max-w-3xl"
        >
          <div className="space-y-4 text-center">
            <div className="aspect-video max-h-[500px] bg-black/5 rounded-xl overflow-hidden border border-[#E2E8F0] flex items-center justify-center">
              <img
                src={serverPreviewUrl}
                alt="Server Render"
                className="w-full h-full object-contain"
              />
            </div>
            <p className="text-xs text-[#16A34A] font-semibold">
              ✓ Server Sharp rasterization verified 100% pixel-parity with visual editor!
            </p>
          </div>
        </Modal>
      )}

      {/* Floating Success Toast */}
      {applyToast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-lg border border-emerald-200 bg-emerald-50 text-emerald-800 text-xs font-semibold animate-in slide-in-from-bottom-3 duration-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{applyToast}</span>
        </div>
      )}
    </div>
  );
};
