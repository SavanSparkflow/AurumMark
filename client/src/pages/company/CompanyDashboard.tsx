import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Images,
  Cpu,
  FolderKanban,
  Stamp,
  Download,
  ArrowRight,
  Upload,
  Plus,
  Users,
  Clock,
  Sparkles,
  Zap,
  ChevronRight,
  UploadCloud,
  ShieldCheck,
  Check,
  Play,
  Video,
  ExternalLink,
} from 'lucide-react';
import {
  dashboardApi,
  designsApi,
  projectsApi,
  assetsApi,
} from '../../api/index.js';
import {
  DashboardMetrics,
  ActivityLogItem,
  Design,
  Project,
} from '../../types/index.js';
import { Card, Button, Badge, Modal, CustomVideoPlayer } from '../../components/common/index.js';
import { useAuthStore } from '../../store/authStore.js';

export const CompanyDashboard: React.FC = () => {
  const { company, role } = useAuthStore();
  const canDownload =
    role === 'Company' ||
    role === 'Designer' ||
    (role === 'Viewer' && company?.settings?.allowViewerDownload !== false);

  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [activities, setActivities] = useState<ActivityLogItem[]>([]);
  const [recentDesigns, setRecentDesigns] = useState<Design[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [previewDesign, setPreviewDesign] = useState<Design | null>(null);
  const [compareMode, setCompareMode] = useState<'watermarked' | 'original'>('watermarked');

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        const [sumRes, actRes, desRes, projRes] = await Promise.all([
          dashboardApi.getSummary(),
          dashboardApi.getActivity(),
          designsApi.list({ limit: 4 }),
          projectsApi.list(),
        ]);

        setMetrics(sumRes.data.data.metrics);
        setActivities(actRes.data.data || []);
        setRecentDesigns(desRes.data.data || []);
        setProjects(projRes.data.data || []);
      } catch (err) {
        console.error('Failed to load dashboard:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchDashboard();
  }, []);

  const statCards = [
    {
      label: 'Uploaded Images',
      value: metrics?.totalUploadedImages || 0,
      icon: Images,
      color: 'text-[#7C3AED]',
      bg: 'bg-[#7C3AED]/10',
      to: '/company/gallery',
    },
    {
      label: 'Processed Images',
      value: metrics?.totalProcessedImages || 0,
      icon: Sparkles,
      color: 'text-[#16A34A]',
      bg: 'bg-[#16A34A]/10',
      to: '/company/gallery?status=processed',
    },
    {
      label: 'Jewellery Projects',
      value: metrics?.totalProjects || 0,
      icon: FolderKanban,
      color: 'text-[#B8860B]',
      bg: 'bg-[#B8860B]/10',
      to: '/company/projects',
    },
    {
      label: 'Saved Templates',
      value: metrics?.savedTemplates || 0,
      icon: Stamp,
      color: 'text-[#6366F1]',
      bg: 'bg-[#6366F1]/10',
      to: '/company/templates',
    },
    {
      label: 'Active Processing',
      value: metrics?.activeProcessingJobs || 0,
      icon: Cpu,
      color: 'text-[#D97706]',
      bg: 'bg-[#D97706]/10',
      to: '/company/history',
    },
    {
      label: 'Recent Downloads',
      value: metrics?.recentDownloads || 0,
      icon: Download,
      color: 'text-[#0284C7]',
      bg: 'bg-[#0284C7]/10',
      to: '/company/downloads',
    },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-white via-white to-[#7C3AED]/5 rounded-2xl border border-[#E2E8F0] p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-[#7C3AED] font-heading mb-1">
            <span className="w-2 h-2 rounded-full bg-[#16A34A] animate-pulse" />
            Workspace Active: {company?.name}
          </div>
          <h1 className="text-2xl font-bold text-[#1E293B] font-heading tracking-tight">
            Company Management Dashboard
          </h1>
          <p className="text-xs text-[#64748B] mt-1">
            Manage your jewellery catalogue, configure watermarks, and control team access.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Link to="/company/upload">
            <Button variant="primary" size="md">
              <Upload className="w-3.5 h-3.5 mr-1.5" />
              Upload Images
            </Button>
          </Link>
          <Link to="/company/editor">
            <Button variant="gold" size="md">
              <Stamp className="w-3.5 h-3.5 mr-1.5" />
              Watermark Studio
            </Button>
          </Link>
        </div>
      </div>

      {/* Metrics Row (Strictly 6 Cards in 1 Line) */}
      <div className="grid grid-cols-6 gap-2 sm:gap-3.5">
        {statCards.map((card, i) => (
          <Link key={i} to={card.to} className="block group">
            <Card className="p-3 sm:p-4 hover:border-[#7C3AED]/50 hover:shadow-xs transition h-full flex flex-col justify-between">
              <div className="flex items-center justify-between mb-2">
                <span className={`p-1.5 sm:p-2 rounded-lg ${card.bg} ${card.color}`}>
                  <card.icon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </span>
                <ArrowRight className="w-3 h-3 text-[#CBD5E1] group-hover:text-[#7C3AED] transition hidden md:block" />
              </div>
              <div>
                <div className="text-base sm:text-xl font-extrabold text-[#1E293B] font-heading leading-tight">
                  {loading ? '...' : card.value}
                </div>
                <div
                  className="text-[10px] sm:text-[11px] font-medium text-[#64748B] mt-0.5 truncate"
                  title={card.label}
                >
                  {card.label}
                </div>
              </div>
            </Card>
          </Link>
        ))}
      </div>

      {/* Main 2-Column Responsive Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* ========================================================= */}
        {/* LEFT COLUMN (approx 65% width) - Core Operations & Visuals */}
        {/* ========================================================= */}
        <div className="lg:col-span-8 space-y-6">
          {/* 1. 🖼️ Recent Jewellery Designs (Photo Grid) */}
          <Card className="p-5 border-[#E2E8F0] shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-[#7C3AED]/10 text-[#7C3AED]">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#1E293B] font-heading">
                    Recent Jewellery Uploads
                  </h3>
                  <p className="text-[11px] text-[#64748B]">
                    Latest pieces added to your digital showcase
                  </p>
                </div>
              </div>

              <Link
                to="/company/gallery"
                className="text-xs font-semibold text-[#7C3AED] hover:underline flex items-center gap-1"
              >
                <span>View Full Gallery</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {loading ? (
              <div className="py-12 text-center text-xs text-[#64748B]">Loading jewellery items...</div>
            ) : recentDesigns.length === 0 ? (
              /* Genuine Interactive Upload Dropzone (No Dummy Data) */
              <div className="p-8 rounded-xl bg-gradient-to-br from-[#F8FAFC] to-[#F1F5F9] border-2 border-dashed border-[#CBD5E1] text-center hover:border-[#7C3AED]/60 transition">
                <div className="w-14 h-14 mx-auto rounded-2xl bg-[#7C3AED]/10 text-[#7C3AED] flex items-center justify-center mb-3 shadow-xs">
                  <UploadCloud className="w-7 h-7" />
                </div>
                <h4 className="text-sm font-bold text-[#1E293B] font-heading">
                  Start Building Your Jewellery Showcase
                </h4>
                <p className="text-xs text-[#64748B] max-w-md mx-auto mt-1 mb-4 leading-relaxed">
                  Upload raw camera photos, high-resolution JPEG, PNG, or WebP renders to apply luxury watermark protection and organize your catalogue.
                </p>

                <div className="flex flex-wrap items-center justify-center gap-2 mb-5 text-[11px] text-[#475569]">
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white border border-[#E2E8F0]">
                    <Check className="w-3 h-3 text-[#16A34A]" /> RAW & High-Res Preservation
                  </span>
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white border border-[#E2E8F0]">
                    <Check className="w-3 h-3 text-[#16A34A]" /> Auto Metadata Sanitization
                  </span>
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white border border-[#E2E8F0]">
                    <Check className="w-3 h-3 text-[#16A34A]" /> Instant Watermark Studio
                  </span>
                </div>

                <Link to="/company/upload">
                  <Button variant="primary" size="md">
                    <Upload className="w-4 h-4 mr-1.5" />
                    Upload Jewellery Photos
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
                {recentDesigns.map((design) => {
                  const displayAsset = design.activeProcessedAssetId || design.originalAssetId;
                  const previewUrl = displayAsset ? assetsApi.getViewUrl(displayAsset) : '';
                  const isWatermarked = design.processingStatus === 'processed';
                  const isVideo =
                    design.mediaType === 'video' ||
                    design.filename?.toLowerCase().endsWith('.mp4') ||
                    design.filename?.toLowerCase().endsWith('.mov') ||
                    design.filename?.toLowerCase().endsWith('.webm');

                  const thumbUrl =
                    isVideo && design.thumbnailAssetId
                      ? assetsApi.getViewUrl(design.thumbnailAssetId)
                      : null;

                  return (
                    <div
                      key={design._id}
                      onClick={() => {
                        setPreviewDesign(design);
                        setCompareMode(design.activeProcessedAssetId ? 'watermarked' : 'original');
                      }}
                      className="group block bg-[#F8FAFC] rounded-xl border border-[#E2E8F0] overflow-hidden hover:border-[#7C3AED]/50 hover:shadow-md transition cursor-pointer select-none"
                    >
                      {/* Media Thumbnail */}
                      <div className="relative aspect-square bg-slate-900 overflow-hidden flex items-center justify-center">
                        {isVideo ? (
                          thumbUrl ? (
                            <img
                              src={thumbUrl}
                              alt={design.filename}
                              className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                              loading="lazy"
                            />
                          ) : previewUrl ? (
                            <video
                              src={previewUrl}
                              muted
                              className="w-full h-full object-cover pointer-events-none"
                            />
                          ) : (
                            <Video className="w-8 h-8 text-[#CBD5E1]" />
                          )
                        ) : previewUrl ? (
                          <img
                            src={previewUrl}
                            alt={design.filename}
                            className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                            loading="lazy"
                          />
                        ) : (
                          <Images className="w-7 h-7 text-[#CBD5E1]" />
                        )}

                        {/* Status Badge Overlay */}
                        <div className="absolute top-2 right-2 z-10">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold shadow-xs ${
                              isWatermarked
                                ? 'bg-[#16A34A] text-white'
                                : 'bg-[#D97706] text-white'
                            }`}
                          >
                            {isWatermarked ? 'Watermarked' : 'Master'}
                          </span>
                        </div>

                        {/* Video Play Overlay */}
                        {isVideo && (
                          <>
                            <div className="absolute inset-0 bg-black/25 group-hover:bg-black/10 flex items-center justify-center transition">
                              <div className="w-9 h-9 rounded-full bg-white/95 text-[#7C3AED] flex items-center justify-center shadow-lg group-hover:scale-110 transition">
                                <Play className="w-4 h-4 fill-[#7C3AED] translate-x-0.5" />
                              </div>
                            </div>
                            <div className="absolute bottom-2 left-2 bg-black/80 text-white text-[9px] font-bold px-1.5 py-0.5 rounded flex items-center gap-1 shadow-xs z-10">
                              <Play className="w-2.5 h-2.5 fill-white" />
                              <span>
                                {design.metadata?.duration
                                  ? `${Math.round(design.metadata.duration)}s`
                                  : 'VIDEO'}
                              </span>
                            </div>
                          </>
                        )}
                      </div>

                      {/* Meta Details */}
                      <div className="p-2.5 bg-white">
                        <div className="flex items-center justify-between gap-1">
                          <span className="font-mono text-[11px] font-bold text-[#1E293B] truncate">
                            {design.sku || 'SKU-PENDING'}
                          </span>
                          {isVideo && (
                            <span className="text-[9px] font-bold px-1 rounded bg-purple-100 text-purple-700 shrink-0">
                              VIDEO
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-[#64748B] truncate mt-0.5" title={design.filename}>
                          {design.filename}
                        </div>
                        <div className="text-[10px] text-[#7C3AED] font-semibold truncate mt-1">
                          {design.projectId?.name || 'Unassigned'}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          {/* 2. 🗂️ Active Jewellery Collections */}
          <Card className="p-5 border-[#E2E8F0] shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-[#B8860B]/10 text-[#B8860B]">
                  <FolderKanban className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#1E293B] font-heading">
                    Active Jewellery Collections
                  </h3>
                  <p className="text-[11px] text-[#64748B]">
                    Segmented catalogues ready for client presentation & export
                  </p>
                </div>
              </div>

              <Link
                to="/company/projects"
                className="text-xs font-semibold text-[#7C3AED] hover:underline flex items-center gap-1"
              >
                <span>Manage Collections</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {loading ? (
              <div className="py-6 text-center text-xs text-[#64748B]">Loading collections...</div>
            ) : projects.length === 0 ? (
              /* Genuine Collection Architecture & Creation Card (No Dummy Data) */
              <div className="p-6 rounded-xl bg-gradient-to-br from-[#FDFBF7] to-white border border-[#B8860B]/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-start gap-3.5">
                  <div className="w-12 h-12 rounded-xl bg-[#B8860B]/10 text-[#B8860B] flex items-center justify-center flex-shrink-0 mt-0.5">
                    <FolderKanban className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-[#1E293B] font-heading">
                      Organize Pieces into Catalogue Collections
                    </h4>
                    <p className="text-[11px] text-[#64748B] mt-0.5 max-w-lg leading-relaxed">
                      Create collections to group designs by metal purity, stone categories, or client presentations for targeted bulk watermarking and wholesale exports.
                    </p>
                    <div className="flex flex-wrap gap-1.5 mt-2.5">
                      <span className="text-[10px] font-semibold text-[#B8860B] bg-[#B8860B]/10 px-2 py-0.5 rounded-md">
                        #BridalLines
                      </span>
                      <span className="text-[10px] font-semibold text-[#B8860B] bg-[#B8860B]/10 px-2 py-0.5 rounded-md">
                        #18KGold
                      </span>
                      <span className="text-[10px] font-semibold text-[#B8860B] bg-[#B8860B]/10 px-2 py-0.5 rounded-md">
                        #SolitaireRings
                      </span>
                      <span className="text-[10px] font-semibold text-[#B8860B] bg-[#B8860B]/10 px-2 py-0.5 rounded-md">
                        #WholesaleExport
                      </span>
                    </div>
                  </div>
                </div>

                <Link to="/company/projects" className="flex-shrink-0 self-start sm:self-center">
                  <Button variant="gold" size="md">
                    <Plus className="w-4 h-4 mr-1.5" />
                    Create Collection
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {projects.slice(0, 4).map((proj) => (
                  <Link
                    key={proj._id}
                    to={`/company/gallery?projectId=${proj._id}`}
                    className="group block p-3.5 rounded-xl border border-[#E2E8F0] hover:border-[#B8860B]/50 hover:bg-[#FDFBF7] transition"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="text-xs font-bold text-[#1E293B] group-hover:text-[#B8860B] transition truncate" title={proj.name}>
                          <span>{proj.name}</span>
                        </div>
                        <p className="text-[11px] text-[#64748B] line-clamp-1">
                          {proj.description || 'Curated jewellery catalogue line'}
                        </p>
                      </div>
                      <Badge variant="gold" size="sm">
                        {proj.designsCount || 0} items
                      </Badge>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-[#7C3AED] font-semibold mt-3 pt-2.5 border-t border-[#E2E8F0]/70">
                      <span>View in Gallery</span>
                      <ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition" />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* ========================================================= */}
        {/* RIGHT COLUMN (approx 35% width) - Shortcuts & Audit Log   */}
        {/* ========================================================= */}
        <div className="lg:col-span-4 space-y-6">
          {/* 1. ⚡ Quick Actions (1-Click Shortcuts) */}
          <Card className="p-5 border-[#E2E8F0] shadow-xs">
            <div className="flex items-center gap-2 mb-3.5">
              <div className="p-1.5 rounded-lg bg-[#7C3AED]/10 text-[#7C3AED]">
                <Zap className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-[#1E293B] font-heading">
                  Quick Actions
                </h3>
                <p className="text-[11px] text-[#64748B]">Instant workflow shortcuts</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Link
                to="/company/upload"
                className="p-3 rounded-xl border border-[#E2E8F0] hover:border-[#7C3AED] hover:bg-[#7C3AED]/5 transition flex flex-col items-center text-center group"
              >
                <div className="w-8 h-8 rounded-lg bg-[#7C3AED]/10 text-[#7C3AED] flex items-center justify-center mb-1.5 group-hover:scale-110 transition">
                  <Upload className="w-4 h-4" />
                </div>
                <span className="text-xs font-bold text-[#1E293B]">Upload Photos</span>
                <span className="text-[10px] text-[#64748B]">RAW & Renders</span>
              </Link>

              <Link
                to="/company/processing"
                className="p-3 rounded-xl border border-[#E2E8F0] hover:border-[#16A34A] hover:bg-[#16A34A]/5 transition flex flex-col items-center text-center group"
              >
                <div className="w-8 h-8 rounded-lg bg-[#16A34A]/10 text-[#16A34A] flex items-center justify-center mb-1.5 group-hover:scale-110 transition">
                  <Sparkles className="w-4 h-4" />
                </div>
                <span className="text-xs font-bold text-[#1E293B]">Bulk Watermark</span>
                <span className="text-[10px] text-[#64748B]">Batch Process</span>
              </Link>

              <Link
                to="/company/projects"
                className="p-3 rounded-xl border border-[#E2E8F0] hover:border-[#B8860B] hover:bg-[#B8860B]/5 transition flex flex-col items-center text-center group"
              >
                <div className="w-8 h-8 rounded-lg bg-[#B8860B]/10 text-[#B8860B] flex items-center justify-center mb-1.5 group-hover:scale-110 transition">
                  <Plus className="w-4 h-4" />
                </div>
                <span className="text-xs font-bold text-[#1E293B]">New Collection</span>
                <span className="text-[10px] text-[#64748B]">Catalogues</span>
              </Link>

              <Link
                to="/company/editor"
                className="p-3 rounded-xl border border-[#6366F1] hover:border-[#6366F1] hover:bg-[#6366F1]/5 transition flex flex-col items-center text-center group"
              >
                <div className="w-8 h-8 rounded-lg bg-[#6366F1]/10 text-[#6366F1] flex items-center justify-center mb-1.5 group-hover:scale-110 transition">
                  <Stamp className="w-4 h-4" />
                </div>
                <span className="text-xs font-bold text-[#1E293B]">Watermark Studio</span>
                <span className="text-[10px] text-[#64748B]">Presets & Logos</span>
              </Link>

              <Link
                to="/company/downloads"
                className="p-3 rounded-xl border border-[#E2E8F0] hover:border-[#0284C7] hover:bg-[#0284C7]/5 transition flex flex-col items-center text-center group"
              >
                <div className="w-8 h-8 rounded-lg bg-[#0284C7]/10 text-[#0284C7] flex items-center justify-center mb-1.5 group-hover:scale-110 transition">
                  <Download className="w-4 h-4" />
                </div>
                <span className="text-xs font-bold text-[#1E293B]">Export ZIP</span>
                <span className="text-[10px] text-[#64748B]">Wholesale Packs</span>
              </Link>

              <Link
                to="/company/team"
                className="p-3 rounded-xl border border-[#E2E8F0] hover:border-[#9333EA] hover:bg-[#9333EA]/5 transition flex flex-col items-center text-center group"
              >
                <div className="w-8 h-8 rounded-lg bg-[#9333EA]/10 text-[#9333EA] flex items-center justify-center mb-1.5 group-hover:scale-110 transition">
                  <Users className="w-4 h-4" />
                </div>
                <span className="text-xs font-bold text-[#1E293B]">Invite Team</span>
                <span className="text-[10px] text-[#64748B]">Designers & Viewers</span>
              </Link>
            </div>
          </Card>

          {/* 2. 🕒 Recent Activity Feed */}
          <Card className="p-5 border-[#E2E8F0] shadow-xs space-y-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-[#B8860B]/10 text-[#B8860B]">
                  <Clock className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#1E293B] font-heading">Recent Activity</h3>
                  <p className="text-[11px] text-[#64748B]">Real-time company audit log</p>
                </div>
              </div>
              <Link
                to="/company/activity"
                className="text-xs font-semibold text-[#7C3AED] hover:underline"
              >
                View All
              </Link>
            </div>

            <div className="divide-y divide-[#E2E8F0]/70">
              {activities.length === 0 ? (
                /* Honest Clean Note when No Audit Records Yet */
                <div className="py-8 text-center space-y-1.5">
                  <Clock className="w-6 h-6 text-[#CBD5E1] mx-auto mb-1" />
                  <p className="text-xs font-semibold text-[#1E293B]">No activity recorded yet</p>
                  <p className="text-[11px] text-[#64748B] max-w-xs mx-auto">
                    Logins, uploads, batch processing, and export downloads will be tracked here in real time.
                  </p>
                </div>
              ) : (
                activities.slice(0, 5).map((act) => {
                  const isLogin = act.action.includes('LOGIN');
                  const isUpload = act.action.includes('UPLOAD');
                  const isProcess = act.action.includes('WATERMARK') || act.action.includes('PROCESS');

                  const dotColor = isLogin ? 'bg-[#7C3AED]' : isUpload ? 'bg-[#16A34A]' : isProcess ? 'bg-[#B8860B]' : 'bg-[#0284C7]';

                  return (
                    <div key={act._id} className="py-2.5 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 overflow-hidden pr-2">
                        <span className={`w-2 h-2 rounded-full ${dotColor} flex-shrink-0`} />
                        <div className="truncate">
                          <span className="font-semibold text-[#1E293B] font-mono text-[11px]">
                            {act.action}
                          </span>
                          <span className="text-[#64748B] text-[11px] block truncate">
                            by {act.actorId?.name || 'System'}
                          </span>
                        </div>
                      </div>
                      <span className="text-[10px] text-[#94A3B8] whitespace-nowrap flex-shrink-0">
                        {new Date(act.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </Card>
        </div>
      </div>

      {/* Dashboard Jewellery Inspection Modal */}
      {previewDesign && (
        <Modal
          isOpen={!!previewDesign}
          onClose={() => setPreviewDesign(null)}
          title={`Jewellery Inspection: ${previewDesign.filename}`}
          description={`SKU: ${previewDesign.sku || 'N/A'}`}
          maxWidth="max-w-4xl"
        >
          <div className="space-y-4">
            {/* Version Switcher Bar */}
            <div className="flex flex-wrap items-center justify-between gap-2.5 bg-[#F8FAFC] p-2.5 rounded-xl border border-[#E2E8F0]">
              <div className="flex items-center gap-2">
                {previewDesign.activeProcessedAssetId && (
                  <Button
                    size="sm"
                    variant={compareMode === 'watermarked' ? 'primary' : 'outline'}
                    onClick={() => setCompareMode('watermarked')}
                    className="whitespace-nowrap"
                  >
                    Watermarked Version
                  </Button>
                )}
                <Button
                  size="sm"
                  variant={compareMode === 'original' ? 'primary' : 'outline'}
                  onClick={() => setCompareMode('original')}
                  className="whitespace-nowrap"
                >
                  Original Master
                </Button>
              </div>

              <div className="flex items-center gap-2">
                <Link to="/company/gallery">
                  <Button size="sm" variant="outline" className="whitespace-nowrap">
                    <ExternalLink className="w-3.5 h-3.5 mr-1" /> View in Gallery
                  </Button>
                </Link>

                {previewDesign.activeProcessedAssetId && canDownload && (
                  <a
                    href={assetsApi.getDownloadUrl(previewDesign.activeProcessedAssetId)}
                    download={
                      previewDesign.filename ||
                      (previewDesign.mediaType === 'video'
                        ? 'watermarked_jewellery.mp4'
                        : 'watermarked_jewellery.webp')
                    }
                  >
                    <Button size="sm" variant="gold" className="whitespace-nowrap">
                      <Download className="w-3.5 h-3.5 mr-1" /> Download Copy
                    </Button>
                  </a>
                )}
              </div>
            </div>

            {/* Media Viewport */}
            <div className="aspect-video max-h-[520px] bg-black rounded-xl overflow-hidden border border-[#E2E8F0] flex items-center justify-center">
              {previewDesign.mediaType === 'video' ||
              previewDesign.filename?.toLowerCase().endsWith('.mp4') ||
              previewDesign.filename?.toLowerCase().endsWith('.mov') ||
              previewDesign.filename?.toLowerCase().endsWith('.webm') ? (
                <CustomVideoPlayer
                  key={`${previewDesign._id}-${compareMode}`}
                  src={
                    compareMode === 'watermarked' && previewDesign.activeProcessedAssetId
                      ? assetsApi.getViewUrl(previewDesign.activeProcessedAssetId)
                      : assetsApi.getViewUrl(previewDesign.originalAssetId)
                  }
                  title={previewDesign.filename}
                  className="w-full h-full"
                />
              ) : (
                <img
                  src={
                    compareMode === 'watermarked' && previewDesign.activeProcessedAssetId
                      ? assetsApi.getViewUrl(previewDesign.activeProcessedAssetId)
                      : assetsApi.getViewUrl(previewDesign.originalAssetId)
                  }
                  alt={previewDesign.filename}
                  className="w-full h-full object-contain"
                />
              )}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
