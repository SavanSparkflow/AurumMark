import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Sliders,
  Plus,
  Copy,
  Trash2,
  Stamp,
  Pencil,
  CheckCircle2,
  Cpu,
  Layers,
  Sparkles,
  Type,
  Image as ImageIcon,
  Grid,
  Search,
  Filter,
} from 'lucide-react';
import { templatesApi } from '../../api/index.js';
import { WatermarkTemplate } from '../../types/index.js';
import { Card, Button, Badge, EmptyState, ConfirmDeleteModal, Pagination } from '../../components/common/index.js';
import { useWatermarkStore } from '../../store/watermarkStore.js';
import { useAuthStore } from '../../store/authStore.js';

export const WatermarkTemplatesPage: React.FC = () => {
  const [templates, setTemplates] = useState<WatermarkTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<WatermarkTemplate | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Search, Filter & Pagination
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(9);
  const setConfig = useWatermarkStore((s) => s.setConfig);
  const { role, permissions } = useAuthStore();
  const navigate = useNavigate();

  const canEdit =
    role === 'Company' || (role === 'Designer' && permissions?.canEditTemplate !== false);
  const canProcess =
    role === 'Company' || (role === 'Designer' && permissions?.canProcess !== false);

  const fetchTemplates = async () => {
    try {
      const res = await templatesApi.list();
      setTemplates(res.data.data || []);
    } catch (err) {
      console.error('Failed to load templates:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  const handleEditTemplate = (template: WatermarkTemplate) => {
    setConfig(template.configuration);
    const editorPath = role === 'Company' ? '/company/editor' : '/designer/editor';
    navigate(`${editorPath}?templateId=${template._id}`);
  };

  const handleDuplicate = async (templateId: string) => {
    try {
      await templatesApi.duplicate(templateId);
      fetchTemplates();
    } catch (err) {
      console.error('Duplicate failed:', err);
    }
  };

  const confirmDeleteTemplate = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await templatesApi.delete(deleteTarget._id);
      setDeleteTarget(null);
      fetchTemplates();
    } catch (err) {
      console.error('Delete failed:', err);
    } finally {
      setDeleting(false);
    }
  };

  const handleSetDefault = async (templateId: string) => {
    try {
      await templatesApi.update(templateId, { isDefault: true });
      fetchTemplates();
    } catch (err) {
      console.error('Failed to set default template:', err);
    }
  };

  const handleApplyToBatch = (templateId: string) => {
    const processingPath =
      role === 'Company' ? '/company/processing' : '/designer/processing';
    navigate(`${processingPath}?templateId=${templateId}`);
  };

  const filteredTemplates = templates.filter((tmpl) => {
    if (typeFilter !== 'all' && tmpl.watermarkType !== typeFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const name = (tmpl.name || '').toLowerCase();
      const desc = (tmpl.description || '').toLowerCase();
      if (!name.includes(q) && !desc.includes(q)) return false;
    }
    return true;
  });

  const totalPages = Math.ceil(filteredTemplates.length / pageSize) || 1;
  const paginatedTemplates = filteredTemplates.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#1E293B] font-heading">
            Watermark Templates
          </h1>
          <p className="text-xs text-[#64748B] mt-0.5">
            Reusable watermark positioning, typography, and logo branding configurations.
          </p>
        </div>

        {canEdit && (
          <Link to={role === 'Company' ? '/company/editor' : '/designer/editor'}>
            <Button variant="primary" size="md">
              <Plus className="w-3.5 h-3.5 mr-1" />
              Create in Studio
            </Button>
          </Link>
        )}
      </div>

      {/* Filter and Search Bar */}
      {templates.length > 0 && (
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3 rounded-xl border border-[#E2E8F0] shadow-xs">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-[#94A3B8] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search templates by name or description..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-9 pr-4 py-1.5 text-xs bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg focus:outline-none focus:border-[#7C3AED] focus:bg-white transition"
            />
          </div>

          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-[#64748B]" />
            <select
              value={typeFilter}
              onChange={(e) => {
                setTypeFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="px-2.5 py-1.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg text-xs font-semibold text-[#1E293B] focus:outline-none focus:border-[#7C3AED] cursor-pointer"
            >
              <option value="all">All Types</option>
              <option value="text">Text Watermark</option>
              <option value="logo">Logo Watermark</option>
              <option value="tiled">Tiled Pattern</option>
            </select>
          </div>
        </div>
      )}

      {loading ? (
        <div className="py-12 text-center text-xs text-[#64748B]">Loading watermark templates...</div>
      ) : templates.length === 0 ? (
        <EmptyState
          icon={Sliders}
          title="No Watermark Templates Saved"
          description="Create and save your first jewellery watermark template to begin bulk operations."
          actionText={canEdit ? 'Open Watermark Studio' : undefined}
          onAction={
            canEdit
              ? () => navigate(role === 'Company' ? '/company/editor' : '/designer/editor')
              : undefined
          }
        />
      ) : filteredTemplates.length === 0 ? (
        <Card className="py-12 text-center text-[#64748B]">
          <div className="font-semibold text-[#1E293B]">No templates match your search criteria.</div>
          <div className="text-xs text-[#64748B] mt-1">Try clearing your search query or type filter.</div>
        </Card>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {paginatedTemplates.map((tmpl) => (
              <Card key={tmpl._id} className="flex flex-col justify-between group">
                <div>
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-10 h-10 rounded-xl bg-[#7C3AED]/10 text-[#7C3AED] flex items-center justify-center">
                      {tmpl.watermarkType === 'logo' ? (
                        <ImageIcon className="w-5 h-5 text-[#B8860B]" />
                      ) : tmpl.watermarkType === 'tiled' ? (
                        <Grid className="w-5 h-5" />
                      ) : (
                        <Type className="w-5 h-5" />
                      )}
                    </div>
                    <div className="flex items-center gap-1.5">
                      {tmpl.isDefault && (
                        <Badge variant="gold" size="sm">
                          Default
                        </Badge>
                      )}
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#F1F5F9] text-[#64748B]">
                        v{tmpl.version}
                      </span>
                    </div>
                  </div>

                  <h3
                    onClick={() => canEdit && handleEditTemplate(tmpl)}
                    className={`text-base font-bold text-[#1E293B] font-heading group-hover:text-[#7C3AED] transition ${
                      canEdit ? 'cursor-pointer hover:underline' : ''
                    }`}
                    title={canEdit ? 'Click to edit template in studio' : undefined}
                  >
                    {tmpl.name}
                  </h3>
                  <p className="text-xs text-[#64748B] mt-1 line-clamp-2">
                    {tmpl.description || 'Saved watermark configuration.'}
                  </p>

                  {/* Configuration Specs */}
                  <div className="mt-4 p-2.5 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] space-y-1 text-[11px] text-[#64748B]">
                    <div className="flex justify-between">
                      <span>Position Preset:</span>
                      <span className="font-semibold text-[#1E293B] capitalize">
                        {tmpl.configuration?.positionPreset || 'bottom-right'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Font & Weight:</span>
                      <span className="font-semibold text-[#1E293B]">
                        {tmpl.configuration?.textConfig?.fontFamily || 'Outfit'} (
                        {tmpl.configuration?.textConfig?.fontWeight || '600'})
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Scaling Policy:</span>
                      <span className="font-semibold text-[#7C3AED] capitalize">
                        {tmpl.configuration?.scalingPolicy || 'relative'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="mt-5 pt-3.5 border-t border-[#E2E8F0] flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    {canEdit && (
                      <button
                        onClick={() => handleEditTemplate(tmpl)}
                        title="Edit Template in Studio"
                        className="px-2.5 py-1 rounded-lg border border-[#7C3AED]/30 bg-[#7C3AED]/10 text-[#7C3AED] hover:bg-[#7C3AED] hover:text-white transition flex items-center gap-1 text-xs font-semibold cursor-pointer shadow-2xs"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                        <span>Edit</span>
                      </button>
                    )}

                    {canEdit && (
                      <button
                        onClick={() => handleDuplicate(tmpl._id)}
                        title="Duplicate Template"
                        className="p-1.5 rounded-lg border border-[#E2E8F0] hover:bg-[#F8FAFC] transition text-[#64748B]"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    )}

                    {role === 'Company' && !tmpl.isDefault && (
                      <button
                        onClick={() => handleSetDefault(tmpl._id)}
                        title="Set as Default"
                        className="p-1.5 rounded-lg border border-[#E2E8F0] hover:bg-[#B8860B]/10 hover:text-[#B8860B] transition text-[#64748B]"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                      </button>
                    )}

                    {canEdit && (
                      <button
                        onClick={() => setDeleteTarget(tmpl)}
                        title="Delete Template"
                        className="p-1.5 rounded-lg border border-[#E2E8F0] hover:bg-[#DC2626]/10 hover:text-[#DC2626] transition text-[#64748B] cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {canProcess && (
                    <Button
                      size="sm"
                      variant="primary"
                      onClick={() => handleApplyToBatch(tmpl._id)}
                    >
                      <Cpu className="w-3.5 h-3.5 mr-1" />
                      Apply Batch
                    </Button>
                  )}
                </div>
              </Card>
            ))}
          </div>

          {filteredTemplates.length > pageSize && (
            <div className="p-4 bg-white rounded-xl border border-[#E2E8F0]">
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={filteredTemplates.length}
                pageSize={pageSize}
                onPageChange={setCurrentPage}
                onPageSizeChange={setPageSize}
                pageSizeOptions={[6, 9, 18, 36]}
                itemName="templates"
              />
            </div>
          )}
        </div>
      )}

      {/* Reusable Confirm Delete Modal */}
      <ConfirmDeleteModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDeleteTemplate}
        title="Delete Watermark Template?"
        description="Are you sure you want to delete this template? Previously processed images will not be affected."
        itemName={deleteTarget?.name}
        confirmText="Delete Template"
        loading={deleting}
      />
    </div>
  );
};
