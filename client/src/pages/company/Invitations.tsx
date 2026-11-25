import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  MailPlus,
  Copy,
  Check,
  Clock,
  Send,
  AlertCircle,
  CheckCircle2,
  Palette,
  Eye,
  RotateCw,
  Trash2,
  X,
  Search,
  Filter,
} from 'lucide-react';
import { companyApi } from '../../api/index.js';
import { Invitation } from '../../types/index.js';
import { Card, Button, Badge, ConfirmDeleteModal, Pagination } from '../../components/common/index.js';

const inviteSchema = z.object({
  email: z.string().email('Please enter a valid business email address'),
  role: z.enum(['Designer', 'Viewer']),
});

type InviteFormData = z.infer<typeof inviteSchema>;

export const Invitations: React.FC = () => {
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string; link?: string } | null>(null);
  const [sending, setSending] = useState(false);
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Invitation | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Search, Filter & Pagination
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<InviteFormData>({
    resolver: zodResolver(inviteSchema),
    defaultValues: { role: 'Designer' },
  });

  const fetchInvitations = async () => {
    try {
      const res = await companyApi.getInvitations();
      setInvitations(res.data.data || []);
    } catch (err) {
      console.error('Failed to load invitations:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInvitations();
  }, []);

  const onSubmit = async (data: InviteFormData) => {
    setSending(true);
    setMessage(null);
    try {
      const res = await companyApi.createInvitation({ email: data.email, role: data.role });
      const inviteUrl =
        res.data.data?.inviteUrl ||
        `${window.location.origin}/invite/accept?token=${res.data.data?.inviteToken}`;
      setMessage({
        type: 'success',
        text: `Invitation generated for ${data.email} as ${data.role}! Token is strictly valid for 7 days.`,
        link: inviteUrl,
      });
      reset();
      fetchInvitations();
    } catch (err: any) {
      setMessage({
        type: 'error',
        text: err.response?.data?.message || 'Failed to send invitation.',
      });
    } finally {
      setSending(false);
    }
  };

  // Resend invitation & renew 7-day token
  const handleResend = async (inv: Invitation) => {
    setResendingId(inv._id);
    try {
      const res = await companyApi.resendInvitation(inv._id);
      const newUrl =
        res.data.data?.inviteUrl ||
        `${window.location.origin}/invite/accept?token=${res.data.data?.inviteToken}`;
      setMessage({
        type: 'success',
        text: `Invitation request resent to ${inv.email}! Token renewed for 7 days.`,
        link: newUrl,
      });
      fetchInvitations();
      setTimeout(() => {
        setMessage((prev) => (prev?.link === newUrl ? prev : null));
      }, 5000);
    } catch (err: any) {
      setMessage({
        type: 'error',
        text: err.response?.data?.message || 'Failed to resend invitation request.',
      });
    } finally {
      setResendingId(null);
    }
  };

  // Revoke invitation
  const confirmRevoke = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await companyApi.deleteInvitation(deleteTarget._id);
      setMessage({
        type: 'success',
        text: `Invitation for ${deleteTarget.email} was successfully revoked.`,
      });
      setDeleteTarget(null);
      fetchInvitations();
      setTimeout(() => setMessage(null), 3000);
    } catch (err: any) {
      setMessage({
        type: 'error',
        text: err.response?.data?.message || 'Failed to revoke invitation.',
      });
    } finally {
      setDeleting(false);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedToken(id);
    setTimeout(() => setCopiedToken(null), 2000);
  };

  const getExpiryDetails = (expiresAt: string) => {
    const diffMs = new Date(expiresAt).getTime() - Date.now();
    if (diffMs <= 0) {
      return {
        isExpired: true,
        text: 'Expired',
        badgeVariant: 'danger' as const,
      };
    }
    const days = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    if (days <= 1) {
      const hours = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60)));
      return {
        isExpired: false,
        text: `Expires in ${hours}h`,
        badgeVariant: 'warning' as const,
      };
    }
    return {
      isExpired: false,
      text: `${days} days left`,
      badgeVariant: 'gold' as const,
    };
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#1E293B] font-heading">Workspace Invitations</h1>
        <p className="text-xs text-[#64748B] mt-0.5">
          Send email invitations to onboard Designers and Viewers into your private workspace. All tokens expire in 7 days and can be resent anytime.
        </p>
      </div>

      {/* Invite Form Card */}
      <Card>
        <div className="flex items-center gap-2 mb-4">
          <div className="p-2 rounded-lg bg-[#7C3AED]/10 text-[#7C3AED]">
            <MailPlus className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-[#1E293B] font-heading">Invite Team Member</h3>
            <p className="text-xs text-[#64748B]">Assign Designer or Viewer permissions (7-day validity)</p>
          </div>
        </div>

        {message && (
          <div
            className={`mb-4 p-3.5 rounded-xl border text-xs space-y-2 ${
              message.type === 'success'
                ? 'bg-[#16A34A]/10 border-[#16A34A]/20 text-[#16A34A]'
                : 'bg-[#DC2626]/10 border-[#DC2626]/20 text-[#DC2626]'
            }`}
          >
            <div className="flex items-center justify-between font-medium">
              <div className="flex items-center gap-2">
                {message.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 shrink-0" />
                )}
                <span>{message.text}</span>
              </div>
              <button
                onClick={() => setMessage(null)}
                className="text-[#64748B] hover:text-[#1E293B] p-0.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {message.link && (
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="text"
                  readOnly
                  value={message.link}
                  className="flex-1 px-2.5 py-1 text-xs rounded-lg border border-[#E2E8F0] bg-white font-mono text-[#1E293B] select-all"
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => copyToClipboard(message.link!, 'new-invite')}
                >
                  {copiedToken === 'new-invite' ? (
                    <>
                      <Check className="w-3.5 h-3.5 mr-1 text-[#16A34A]" /> Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 mr-1" /> Copy Link
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="md:col-span-2">
            <label className="block text-xs font-semibold text-[#1E293B] font-heading mb-1">
              Email Address
            </label>
            <input
              type="email"
              {...register('email')}
              placeholder="e.g. designer@jewellerycraft.com"
              className="w-full px-3 py-2 text-xs border border-[#E2E8F0] rounded-lg focus:outline-none focus:border-[#7C3AED]"
            />
            {errors.email && (
              <p className="mt-1 text-[11px] text-[#DC2626]">{errors.email.message}</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#1E293B] font-heading mb-1">
              Assign Role
            </label>
            <select
              {...register('role')}
              className="w-full px-3 py-2 text-xs border border-[#E2E8F0] rounded-lg bg-white font-semibold focus:outline-none focus:border-[#7C3AED]"
            >
              <option value="Designer">Designer (Image & Watermark Studio)</option>
              <option value="Viewer">Viewer (Read-Only Catalogue)</option>
            </select>
          </div>

          <div className="md:col-span-3 flex justify-end pt-1">
            <Button type="submit" disabled={sending} variant="primary" size="md">
              <Send className="w-3.5 h-3.5 mr-1" />
              {sending ? 'Generating Invite...' : 'Generate 7-Day Invitation'}
            </Button>
          </div>
        </form>
      </Card>

      {/* Pending Invites Table */}
      {(() => {
        const filteredInvitations = invitations.filter((inv) => {
          if (roleFilter !== 'all' && inv.invitedRole !== roleFilter) return false;
          if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            const email = (inv.email || '').toLowerCase();
            const by = (inv.invitedBy?.name || '').toLowerCase();
            if (!email.includes(q) && !by.includes(q)) return false;
          }
          return true;
        });

        const totalPages = Math.ceil(filteredInvitations.length / pageSize) || 1;
        const paginatedInvitations = filteredInvitations.slice(
          (currentPage - 1) * pageSize,
          currentPage * pageSize
        );

        return (
          <Card className="p-0 overflow-hidden">
            <div className="px-5 py-3.5 border-b border-[#E2E8F0] bg-[#F8FAFC] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-[#1E293B] font-heading">Pending & Unaccepted Invitations</h3>
                <Badge variant="warning">{filteredInvitations.length}</Badge>
              </div>
              <span className="text-xs text-[#64748B] font-medium flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-[#B8860B]" />
                Tokens strictly expire after 7 days
              </span>
            </div>

            {/* Search and Role Filter Bar */}
            {invitations.length > 0 && (
              <div className="p-3 border-b border-[#E2E8F0] bg-white flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-[#94A3B8] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search invitations by email or sender..."
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
                    value={roleFilter}
                    onChange={(e) => {
                      setRoleFilter(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="px-2.5 py-1.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg text-xs font-semibold text-[#1E293B] focus:outline-none focus:border-[#7C3AED] cursor-pointer"
                  >
                    <option value="all">All Roles</option>
                    <option value="Designer">Designer</option>
                    <option value="Viewer">Viewer</option>
                  </select>
                </div>
              </div>
            )}

            {/* Mobile & Tablet Card View */}
            <div className="md:hidden divide-y divide-[#E2E8F0]">
              {loading ? (
                <div className="py-8 text-center text-xs text-[#64748B]">Loading invitations...</div>
              ) : filteredInvitations.length === 0 ? (
                <div className="py-8 text-center text-xs text-[#64748B]">
                  {searchQuery || roleFilter !== 'all'
                    ? 'No invitations match your search criteria.'
                    : 'No pending invitations.'}
                </div>
              ) : (
                paginatedInvitations.map((inv) => {
                  const expiry = getExpiryDetails(inv.expiresAt);
                  const isResending = resendingId === inv._id;
                  const computedInviteUrl =
                    inv.inviteUrl ||
                    (inv.rawToken
                      ? `${window.location.origin}/invite/accept?token=${inv.rawToken}`
                      : '');

                  return (
                    <div key={inv._id} className="p-4 space-y-3 hover:bg-[#F8FAFC]/60 transition">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="font-semibold text-xs text-[#1E293B] font-mono break-all">
                            {inv.email}
                          </div>
                          <div className="text-[11px] text-[#64748B] mt-0.5">
                            Sent by {inv.invitedBy?.name || 'Owner'}
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          {inv.invitedRole === 'Designer' ? (
                            <Badge variant="gold" size="sm">
                              <Palette className="w-3 h-3" /> Designer
                            </Badge>
                          ) : (
                            <Badge variant="success" size="sm">
                              <Eye className="w-3 h-3" /> Viewer
                            </Badge>
                          )}
                          <Badge variant={expiry.badgeVariant} size="sm">
                            {expiry.text}
                          </Badge>
                        </div>
                      </div>

                      {/* Link Copy Box */}
                      {expiry.isExpired ? (
                        <div className="p-2 rounded-lg bg-[#FEF2F2] border border-[#FCA5A5] text-[11px] text-[#DC2626]">
                          Token Expired — click Resend below to renew link
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 bg-[#F8FAFC] p-1.5 rounded-lg border border-[#E2E8F0]">
                          <input
                            type="text"
                            readOnly
                            value={computedInviteUrl}
                            placeholder={computedInviteUrl ? '' : 'Click Resend to generate link'}
                            className="w-full px-2 py-1 text-[11px] rounded bg-white border border-[#E2E8F0] font-mono text-[#1E293B] select-all truncate focus:outline-none"
                          />
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              if (computedInviteUrl) {
                                copyToClipboard(computedInviteUrl, inv._id);
                              } else {
                                handleResend(inv);
                              }
                            }}
                            className="shrink-0 px-2 py-1 text-xs"
                          >
                            {copiedToken === inv._id ? (
                              <>
                                <Check className="w-3.5 h-3.5 mr-1 text-[#16A34A]" /> Copied!
                              </>
                            ) : (
                              <>
                                <Copy className="w-3.5 h-3.5 mr-1" /> Copy
                              </>
                            )}
                          </Button>
                        </div>
                      )}

                      {/* Expiry Date & Action Buttons */}
                      <div className="flex items-center justify-between pt-1 text-[11px] text-[#64748B]">
                        <div className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-[#94A3B8]" />
                          <span>Exp: {new Date(inv.expiresAt).toLocaleDateString()}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="primary"
                            disabled={isResending}
                            onClick={() => handleResend(inv)}
                            className="bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-xs px-2.5 py-1"
                          >
                            <RotateCw
                              className={`w-3 h-3 mr-1 ${isResending ? 'animate-spin' : ''}`}
                            />
                            {isResending ? 'Resending...' : 'Resend'}
                          </Button>
                          <button
                            onClick={() => setDeleteTarget(inv)}
                            title="Revoke Invitation"
                            className="p-1.5 rounded-lg border border-[#E2E8F0] text-[#64748B] hover:text-[#DC2626] hover:border-[#DC2626]/30 hover:bg-[#DC2626]/10 transition cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs min-w-[850px]">
                <thead>
                  <tr className="border-b border-[#E2E8F0] text-[11px] font-bold text-[#64748B] uppercase tracking-wider font-heading">
                    <th className="py-3 px-5">Invited Email</th>
                    <th className="py-3 px-5">Invited Role</th>
                    <th className="py-3 px-5">Invitation Link (Copy & Share Anytime)</th>
                    <th className="py-3 px-5">Sent By</th>
                    <th className="py-3 px-5">Expires On (7 Days)</th>
                    <th className="py-3 px-5">Status</th>
                    <th className="py-3 px-5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8F0]">
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-[#64748B]">
                        Loading invitations...
                      </td>
                    </tr>
                  ) : filteredInvitations.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-[#64748B]">
                        {searchQuery || roleFilter !== 'all'
                          ? 'No invitations match your search criteria.'
                          : 'No pending invitations.'}
                      </td>
                    </tr>
                  ) : (
                    paginatedInvitations.map((inv) => {
                      const expiry = getExpiryDetails(inv.expiresAt);
                      const isResending = resendingId === inv._id;
                      const computedInviteUrl =
                        inv.inviteUrl ||
                        (inv.rawToken
                          ? `${window.location.origin}/invite/accept?token=${inv.rawToken}`
                          : '');

                      return (
                        <tr key={inv._id} className="hover:bg-[#F8FAFC]/60 transition">
                          <td className="py-3 px-5 font-semibold text-[#1E293B] font-mono">
                            {inv.email}
                          </td>
                          <td className="py-3 px-5">
                            {inv.invitedRole === 'Designer' ? (
                              <Badge variant="gold">
                                <Palette className="w-3 h-3" /> Designer
                              </Badge>
                            ) : (
                              <Badge variant="success">
                                <Eye className="w-3 h-3" /> Viewer
                              </Badge>
                            )}
                          </td>
                          <td className="py-3.5 px-5 min-w-[280px]">
                            {expiry.isExpired ? (
                              <div className="flex items-center gap-2">
                                <Badge variant="danger">Token Expired</Badge>
                                <span className="text-[11px] text-[#64748B]">Click "Resend" to renew link</span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1.5 bg-[#F8FAFC] p-1.5 rounded-lg border border-[#E2E8F0]">
                                <input
                                  type="text"
                                  readOnly
                                  value={computedInviteUrl}
                                  placeholder={computedInviteUrl ? '' : 'Click Resend to generate link'}
                                  className="w-full px-2 py-1 text-[11px] rounded bg-white border border-[#E2E8F0] font-mono text-[#1E293B] select-all truncate focus:outline-none"
                                />
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    if (computedInviteUrl) {
                                      copyToClipboard(computedInviteUrl, inv._id);
                                    } else {
                                      handleResend(inv);
                                    }
                                  }}
                                  className="shrink-0 px-2.5 py-1 text-xs"
                                  title="Copy invitation link"
                                >
                                  {copiedToken === inv._id ? (
                                    <>
                                      <Check className="w-3.5 h-3.5 mr-1 text-[#16A34A]" /> Copied!
                                    </>
                                  ) : (
                                    <>
                                      <Copy className="w-3.5 h-3.5 mr-1" /> Copy Link
                                    </>
                                  )}
                                </Button>
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-5 text-[#64748B]">
                            {inv.invitedBy?.name || 'Owner'}
                          </td>
                          <td className="py-3 px-5 text-[#64748B]">
                            <div className="flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5 text-[#64748B]" />
                              {new Date(inv.expiresAt).toLocaleDateString()}
                            </div>
                          </td>
                          <td className="py-3 px-5">
                            <Badge variant={expiry.badgeVariant}>
                              {expiry.text}
                            </Badge>
                          </td>
                          <td className="py-3 px-5 text-right">
                            <div className="inline-flex items-center gap-2">
                              <Button
                                size="sm"
                                variant="primary"
                                disabled={isResending}
                                onClick={() => handleResend(inv)}
                                className="bg-[#7C3AED] hover:bg-[#6D28D9] text-white shadow-xs cursor-pointer"
                                title="Resend invitation and renew token for 7 days"
                              >
                                <RotateCw
                                  className={`w-3.5 h-3.5 mr-1 ${isResending ? 'animate-spin' : ''}`}
                                />
                                {isResending ? 'Resending...' : 'Resend'}
                              </Button>

                              <button
                                onClick={() => setDeleteTarget(inv)}
                                title="Revoke Invitation"
                                className="p-1.5 rounded-lg border border-[#E2E8F0] text-[#64748B] hover:text-[#DC2626] hover:border-[#DC2626]/30 hover:bg-[#DC2626]/10 transition cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {filteredInvitations.length > pageSize && (
              <div className="p-4 border-t border-[#E2E8F0]">
                <Pagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  totalItems={filteredInvitations.length}
                  pageSize={pageSize}
                  onPageChange={setCurrentPage}
                  onPageSizeChange={setPageSize}
                  pageSizeOptions={[5, 10, 20, 50]}
                  itemName="invitations"
                />
              </div>
            )}
          </Card>
        );
      })()}

      {/* Confirm Revoke Modal */}
      <ConfirmDeleteModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmRevoke}
        title="Revoke Workspace Invitation?"
        description="Are you sure you want to cancel this pending invitation? The invitation link will immediately become invalid."
        itemName={deleteTarget?.email}
        confirmText="Revoke Invitation"
        loading={deleting}
      />
    </div>
  );
};
