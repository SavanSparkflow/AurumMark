import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Users,
  UserCheck,
  UserX,
  Trash2,
  MailPlus,
  ShieldCheck,
  Palette,
  Eye,
  AlertCircle,
  CheckCircle2,
  RotateCw,
  Copy,
  Check,
  Clock,
  Send,
  X,
  ExternalLink,
  KeyRound,
  Lock,
  Search,
  Filter,
  Sparkles,
} from 'lucide-react';
import { companyApi } from '../../api/index.js';
import { CompanyMembership, Invitation } from '../../types/index.js';
import { Card, Button, Badge, ConfirmDeleteModal, Pagination } from '../../components/common/index.js';

export const TeamMembers: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const queryTab = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState<'members' | 'invitations'>(
    queryTab === 'invitations' ? 'invitations' : 'members'
  );

  useEffect(() => {
    if (queryTab === 'invitations') {
      setActiveTab('invitations');
    } else if (queryTab === 'members') {
      setActiveTab('members');
    }
  }, [queryTab]);

  const handleTabChange = (tab: 'members' | 'invitations') => {
    setActiveTab(tab);
    setSearchParams(tab === 'invitations' ? { tab: 'invitations' } : {});
  };

  const [members, setMembers] = useState<CompanyMembership[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [loadingInvites, setLoadingInvites] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Members Pagination & Filter
  const [memberSearch, setMemberSearch] = useState('');
  const [memberRoleFilter, setMemberRoleFilter] = useState('all');
  const [memberPage, setMemberPage] = useState(1);
  const [memberPageSize, setMemberPageSize] = useState(10);

  // Invitations Pagination, Search & Expiry Filter
  const [inviteSearch, setInviteSearch] = useState('');
  const [inviteStatusFilter, setInviteStatusFilter] = useState<'all' | 'active' | 'expired'>('all');
  const [invitePage, setInvitePage] = useState(1);
  const [invitePageSize, setInvitePageSize] = useState(5);

  // Modal for displaying newly created or renewed invitation link
  const [newGeneratedLinkModal, setNewGeneratedLinkModal] = useState<{
    email: string;
    url: string;
    role?: string;
    isRenewed?: boolean;
    expiresAt?: string;
  } | null>(null);

  // Modals & action states
  const [deleteTarget, setDeleteTarget] = useState<CompanyMembership | null>(null);
  const [deleteInviteTarget, setDeleteInviteTarget] = useState<Invitation | null>(null);
  const [passwordResetTarget, setPasswordResetTarget] = useState<CompanyMembership | null>(null);
  const [newMemberPassword, setNewMemberPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

  const [deleting, setDeleting] = useState(false);
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState<string | null>(null);

  // Direct invite modal state
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'Designer' | 'Viewer'>('Designer');
  const [sendingInvite, setSendingInvite] = useState(false);
  const [recentInviteUrl, setRecentInviteUrl] = useState<{ email: string; url: string } | null>(null);

  const fetchMembers = async () => {
    try {
      const res = await companyApi.getMembers();
      setMembers(res.data.data || []);
    } catch (err) {
      console.error('Failed to load members:', err);
    } finally {
      setLoadingMembers(false);
    }
  };

  const fetchInvitations = async () => {
    try {
      const res = await companyApi.getInvitations();
      setInvitations(res.data.data || []);
    } catch (err) {
      console.error('Failed to load invitations:', err);
    } finally {
      setLoadingInvites(false);
    }
  };

  useEffect(() => {
    fetchMembers();
    fetchInvitations();
  }, []);

  const handleRoleChange = async (memberId: string, newRole: 'Designer' | 'Viewer') => {
    try {
      await companyApi.updateMember(memberId, { role: newRole });
      setMessage({ type: 'success', text: `Member role updated to ${newRole}.` });
      fetchMembers();
      setTimeout(() => setMessage(null), 3000);
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to update role.' });
    }
  };

  const handleStatusToggle = async (memberId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'active' ? 'deactivated' : 'active';
    try {
      await companyApi.updateMember(memberId, { status: newStatus });
      setMessage({ type: 'success', text: `Member status set to ${newStatus}.` });
      fetchMembers();
      setTimeout(() => setMessage(null), 3000);
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to change status.' });
    }
  };

  const confirmDeleteMember = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await companyApi.deleteMember(deleteTarget._id);
      setMessage({ type: 'success', text: 'Member removed from company workspace.' });
      setDeleteTarget(null);
      fetchMembers();
      setTimeout(() => setMessage(null), 3000);
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to delete member.' });
    } finally {
      setDeleting(false);
    }
  };

  // Set / Reset Member Password for immediate regular login
  const handleSaveMemberPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordResetTarget) return;
    if (newMemberPassword.length < 8) {
      setMessage({ type: 'error', text: 'Password must be at least 8 characters long.' });
      return;
    }

    setSavingPassword(true);
    try {
      const res = await companyApi.resetMemberPassword(passwordResetTarget._id, {
        newPassword: newMemberPassword,
      });
      setMessage({
        type: 'success',
        text: res.data?.message || 'Password updated successfully! Member can now log in at /login.',
      });
      setPasswordResetTarget(null);
      setNewMemberPassword('');
      setTimeout(() => setMessage(null), 6000);
    } catch (err: any) {
      setMessage({
        type: 'error',
        text: err.response?.data?.message || 'Failed to set member password.',
      });
    } finally {
      setSavingPassword(false);
    }
  };

  // Resend / Renew expired invitation and generate fresh 7-day link
  const handleResendInvitation = async (invitation: Invitation) => {
    setResendingId(invitation._id);
    try {
      const res = await companyApi.resendInvitation(invitation._id);
      const newUrl =
        res.data.data?.inviteUrl ||
        `${window.location.origin}/invite/accept?token=${res.data.data?.inviteToken}`;

      if (newUrl) {
        navigator.clipboard.writeText(newUrl);
        setCopiedLink(invitation._id);
      }

      setNewGeneratedLinkModal({
        email: invitation.email,
        url: newUrl,
        role: invitation.invitedRole,
        isRenewed: true,
        expiresAt: res.data.data?.expiresAt,
      });

      setMessage({
        type: 'success',
        text: `New 7-day invitation link generated for ${invitation.email} and copied to clipboard!`,
      });
      await fetchInvitations();
    } catch (err: any) {
      setMessage({
        type: 'error',
        text: err.response?.data?.message || 'Failed to generate new invitation link.',
      });
    } finally {
      setResendingId(null);
    }
  };

  // Revoke / delete invitation
  const confirmDeleteInvitation = async () => {
    if (!deleteInviteTarget) return;
    setDeleting(true);
    try {
      await companyApi.deleteInvitation(deleteInviteTarget._id);
      setMessage({
        type: 'success',
        text: `Invitation for ${deleteInviteTarget.email} was successfully revoked.`,
      });
      if (newGeneratedLinkModal?.email === deleteInviteTarget.email) {
        setNewGeneratedLinkModal(null);
      }
      setDeleteInviteTarget(null);
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

  // Create new invitation from modal
  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;

    setSendingInvite(true);
    try {
      const res = await companyApi.createInvitation({
        email: inviteEmail.trim(),
        role: inviteRole,
      });
      const newUrl =
        res.data.data?.inviteUrl ||
        `${window.location.origin}/invite/accept?token=${res.data.data?.inviteToken}`;

      if (newUrl) {
        navigator.clipboard.writeText(newUrl);
      }

      setNewGeneratedLinkModal({
        email: inviteEmail.trim(),
        url: newUrl,
        role: inviteRole,
        isRenewed: false,
        expiresAt: res.data.data?.expiresAt,
      });

      setMessage({
        type: 'success',
        text: `Invitation link created for ${inviteEmail}! Token is valid for 7 days.`,
      });
      setIsInviteModalOpen(false);
      setInviteEmail('');
      setInviteRole('Designer');
      fetchInvitations();
    } catch (err: any) {
      setMessage({
        type: 'error',
        text: err.response?.data?.message || 'Failed to send invitation.',
      });
    } finally {
      setSendingInvite(false);
    }
  };

  const copyToClipboard = (text: string, identifier?: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedLink(identifier || text);
    setTimeout(() => setCopiedLink(null), 2500);
  };

  // Calculate 7-day expiration status & days remaining
  const getExpiryDetails = (expiresAt: string) => {
    const diffMs = new Date(expiresAt).getTime() - Date.now();
    if (diffMs <= 0) {
      return {
        isExpired: true,
        text: 'Expired',
        subtext: '7-day window passed',
        badgeVariant: 'danger' as const,
      };
    }
    const days = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    if (days <= 1) {
      const hours = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60)));
      return {
        isExpired: false,
        text: `Expires in ${hours}h`,
        subtext: `${hours} hours remaining`,
        badgeVariant: 'warning' as const,
      };
    }
    return {
      isExpired: false,
      text: `${days} days left`,
      subtext: `Valid for ${days} more days`,
      badgeVariant: 'gold' as const,
    };
  };

  const filteredMembers = members.filter((m) => {
    if (memberRoleFilter !== 'all' && m.role !== memberRoleFilter) return false;
    if (memberSearch.trim()) {
      const q = memberSearch.toLowerCase();
      const name = (m.userId?.name || '').toLowerCase();
      const email = (m.userId?.email || '').toLowerCase();
      if (!name.includes(q) && !email.includes(q)) return false;
    }
    return true;
  });

  const memberTotalPages = Math.ceil(filteredMembers.length / memberPageSize) || 1;
  const paginatedMembers = filteredMembers.slice(
    (memberPage - 1) * memberPageSize,
    memberPage * memberPageSize
  );

  const now = Date.now();
  const expiredInvitesCount = invitations.filter(
    (inv) => new Date(inv.expiresAt).getTime() <= now
  ).length;
  const activeInvitesCount = invitations.length - expiredInvitesCount;

  const filteredInvitations = invitations.filter((inv) => {
    const isExpired = new Date(inv.expiresAt).getTime() <= now;
    if (inviteStatusFilter === 'active' && isExpired) return false;
    if (inviteStatusFilter === 'expired' && !isExpired) return false;

    if (inviteSearch.trim()) {
      const q = inviteSearch.toLowerCase();
      const email = (inv.email || '').toLowerCase();
      const by = (inv.invitedBy?.name || '').toLowerCase();
      if (!email.includes(q) && !by.includes(q)) return false;
    }
    return true;
  });

  const inviteTotalPages = Math.ceil(filteredInvitations.length / invitePageSize) || 1;
  const paginatedInvitations = filteredInvitations.slice(
    (invitePage - 1) * invitePageSize,
    invitePage * invitePageSize
  );

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Users className="w-6 h-6 text-[#7C3AED]" />
            <h1 className="text-2xl font-bold text-[#1E293B] font-heading">Team Members</h1>
          </div>
          <p className="text-xs text-[#64748B] mt-0.5">
            Manage active members and pending invitations. Copy invite links anytime, resend expired requests, or set member passwords.
          </p>
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          <Button
            variant="primary"
            size="md"
            onClick={() => setIsInviteModalOpen(true)}
            className="w-full sm:w-auto"
          >
            <MailPlus className="w-3.5 h-3.5 mr-1" />
            Invite New Member
          </Button>
        </div>
      </div>

      {/* Modern SaaS Tabs */}
      <div className="flex items-center gap-1 border-b border-[#E2E8F0]">
        <button
          type="button"
          onClick={() => handleTabChange('members')}
          className={`flex items-center gap-2 px-4 py-3 text-xs font-bold font-heading border-b-2 transition select-none cursor-pointer ${
            activeTab === 'members'
              ? 'border-[#7C3AED] text-[#7C3AED] bg-[#7C3AED]/5 rounded-t-lg'
              : 'border-transparent text-[#64748B] hover:text-[#1E293B] hover:border-[#CBD5E1]'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Active Members</span>
          <span
            className={`text-[10px] font-bold px-2 py-0.5 rounded-full transition ${
              activeTab === 'members'
                ? 'bg-[#7C3AED] text-white'
                : 'bg-[#F1F5F9] text-[#64748B]'
            }`}
          >
            {members.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => handleTabChange('invitations')}
          className={`flex items-center gap-2 px-4 py-3 text-xs font-bold font-heading border-b-2 transition select-none cursor-pointer ${
            activeTab === 'invitations'
              ? 'border-[#7C3AED] text-[#7C3AED] bg-[#7C3AED]/5 rounded-t-lg'
              : 'border-transparent text-[#64748B] hover:text-[#1E293B] hover:border-[#CBD5E1]'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>Pending Invitations</span>
          <span
            className={`text-[10px] font-bold px-2 py-0.5 rounded-full transition ${
              activeTab === 'invitations'
                ? 'bg-[#B8860B] text-white'
                : 'bg-[#FEF3C7] text-[#B8860B]'
            }`}
          >
            {invitations.length}
          </span>
        </button>
      </div>

      {/* TAB 1: Active Team Members Table */}
      {activeTab === 'members' && (
      <Card className="p-0 overflow-hidden">
        <div className="px-5 py-3.5 border-b border-[#E2E8F0] bg-[#F8FAFC] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-[#1E293B] font-heading">Active Workspace Members</h2>
            <Badge variant="primary">{filteredMembers.length}</Badge>
          </div>
          <div className="flex items-center gap-2 text-xs text-[#16A34A] font-medium">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Active members can log in directly at /login using their email & password</span>
          </div>
        </div>

        {/* Member Search & Role Filter Bar */}
        <div className="p-3 border-b border-[#E2E8F0] bg-white flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-[#94A3B8] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search members by name or email..."
              value={memberSearch}
              onChange={(e) => {
                setMemberSearch(e.target.value);
                setMemberPage(1);
              }}
              className="w-full pl-9 pr-4 py-1.5 text-xs bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg focus:outline-none focus:border-[#7C3AED] focus:bg-white transition"
            />
          </div>

          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-[#64748B]" />
            <select
              value={memberRoleFilter}
              onChange={(e) => {
                setMemberRoleFilter(e.target.value);
                setMemberPage(1);
              }}
              className="px-2.5 py-1.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg text-xs font-semibold text-[#1E293B] focus:outline-none focus:border-[#7C3AED] cursor-pointer"
            >
              <option value="all">All Roles</option>
              <option value="Company">Company Admin</option>
              <option value="Designer">Designer</option>
              <option value="Viewer">Viewer</option>
            </select>
          </div>
        </div>

        {/* Mobile & Tablet Card View */}
        <div className="md:hidden divide-y divide-[#E2E8F0]">
          {loadingMembers ? (
            <div className="py-8 text-center text-xs text-[#64748B]">Loading team members...</div>
          ) : filteredMembers.length === 0 ? (
            <div className="py-8 text-center text-xs text-[#64748B]">
              {memberSearch || memberRoleFilter !== 'all'
                ? 'No members match your search criteria.'
                : 'No members found.'}
            </div>
          ) : (
            paginatedMembers.map((m) => {
              const isOwner = m.role === 'Company';
              return (
                <div key={m._id} className="p-4 space-y-3 hover:bg-[#F8FAFC]/60 transition">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-[#7C3AED]/10 text-[#7C3AED] font-bold flex items-center justify-center font-heading text-xs shrink-0">
                        {m.userId?.name?.slice(0, 2).toUpperCase() || 'U'}
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold text-xs text-[#1E293B] font-heading truncate">
                          {m.userId?.name || 'Workspace Member'}
                        </div>
                        <div className="text-[11px] text-[#64748B] font-mono truncate">{m.userId?.email}</div>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      {m.role === 'Company' ? (
                        <Badge variant="primary" size="sm">
                          <ShieldCheck className="w-3 h-3" /> Owner
                        </Badge>
                      ) : m.role === 'Designer' ? (
                        <Badge variant="gold" size="sm">
                          <Palette className="w-3 h-3" /> Designer
                        </Badge>
                      ) : (
                        <Badge variant="success" size="sm">
                          <Eye className="w-3 h-3" /> Viewer
                        </Badge>
                      )}
                      <Badge variant={m.status === 'active' ? 'success' : 'danger'} size="sm">
                        {m.status === 'active' ? 'Active' : 'Deactivated'}
                      </Badge>
                    </div>
                  </div>

                  <div className="text-[11px] text-[#64748B]">
                    Joined: {new Date(m.createdAt).toLocaleDateString()}
                  </div>

                  {/* Actions for Mobile */}
                  {isOwner ? (
                    <div className="text-[11px] font-semibold text-[#64748B] italic pt-1">
                      Workspace Owner (Full Access)
                    </div>
                  ) : (
                    <div className="flex items-center justify-between gap-2 pt-2 border-t border-[#F1F5F9]">
                      <select
                        value={m.role}
                        onChange={(e) =>
                          handleRoleChange(m._id, e.target.value as 'Designer' | 'Viewer')
                        }
                        className="px-2 py-1 text-xs border border-[#E2E8F0] rounded-lg bg-white font-semibold focus:outline-none focus:border-[#7C3AED]"
                      >
                        <option value="Designer">Designer</option>
                        <option value="Viewer">Viewer</option>
                      </select>

                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => {
                            setPasswordResetTarget(m);
                            setNewMemberPassword('');
                          }}
                          title="Set or reset login password"
                          className="p-1.5 rounded-lg border border-[#E2E8F0] text-[#7C3AED] hover:bg-[#7C3AED]/10 transition"
                        >
                          <KeyRound className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleStatusToggle(m._id, m.status)}
                          title={m.status === 'active' ? 'Deactivate Member' : 'Activate Member'}
                          className={`p-1.5 rounded-lg border transition ${
                            m.status === 'active'
                              ? 'border-[#E2E8F0] text-[#D97706] hover:bg-[#D97706]/10'
                              : 'border-[#16A34A]/30 text-[#16A34A] hover:bg-[#16A34A]/10'
                          }`}
                        >
                          {m.status === 'active' ? (
                            <UserX className="w-3.5 h-3.5" />
                          ) : (
                            <UserCheck className="w-3.5 h-3.5" />
                          )}
                        </button>
                        <button
                          onClick={() => setDeleteTarget(m)}
                          title="Remove Member"
                          className="p-1.5 rounded-lg border border-[#E2E8F0] text-[#64748B] hover:text-[#DC2626] hover:border-[#DC2626]/30 hover:bg-[#DC2626]/10 transition"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Desktop Table View */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[750px]">
            <thead>
              <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC] text-[11px] font-bold text-[#64748B] uppercase tracking-wider font-heading">
                <th className="py-3 px-5">Member</th>
                <th className="py-3 px-5">Current Role</th>
                <th className="py-3 px-5">Status</th>
                <th className="py-3 px-5">Joined Date</th>
                <th className="py-3 px-5 text-right">Role Assignment & Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2E8F0] text-xs">
              {loadingMembers ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-[#64748B]">
                    Loading team members...
                  </td>
                </tr>
              ) : filteredMembers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-[#64748B]">
                    {memberSearch || memberRoleFilter !== 'all'
                      ? 'No members match your search criteria.'
                      : 'No members found.'}
                  </td>
                </tr>
              ) : (
                paginatedMembers.map((m) => {
                  const isOwner = m.role === 'Company';
                  return (
                    <tr key={m._id} className="hover:bg-[#F8FAFC]/60 transition">
                      <td className="py-3.5 px-5">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-[#7C3AED]/10 text-[#7C3AED] font-bold flex items-center justify-center font-heading text-xs">
                            {m.userId?.name?.slice(0, 2).toUpperCase() || 'U'}
                          </div>
                          <div>
                            <div className="font-semibold text-[#1E293B] font-heading">
                              {m.userId?.name || 'Workspace Member'}
                            </div>
                            <div className="text-[11px] text-[#64748B] font-mono">{m.userId?.email}</div>
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-5">
                        {m.role === 'Company' ? (
                          <Badge variant="primary">
                            <ShieldCheck className="w-3 h-3" />
                            Company Owner
                          </Badge>
                        ) : m.role === 'Designer' ? (
                          <Badge variant="gold">
                            <Palette className="w-3 h-3" />
                            Designer
                          </Badge>
                        ) : (
                          <Badge variant="success">
                            <Eye className="w-3 h-3" />
                            Viewer
                          </Badge>
                        )}
                      </td>

                      <td className="py-3.5 px-5">
                        <Badge variant={m.status === 'active' ? 'success' : 'danger'}>
                          {m.status === 'active' ? 'Active' : 'Deactivated'}
                        </Badge>
                      </td>

                      <td className="py-3.5 px-5 text-[#64748B]">
                        {new Date(m.createdAt).toLocaleDateString()}
                      </td>

                      <td className="py-3.5 px-5 text-right">
                        {isOwner ? (
                          <span className="text-[11px] font-semibold text-[#64748B] italic">
                            Workspace Owner
                          </span>
                        ) : (
                          <div className="inline-flex items-center gap-2">
                            {/* Role Switcher: Strictly between Designer and Viewer */}
                            <select
                              value={m.role}
                              onChange={(e) =>
                                handleRoleChange(m._id, e.target.value as 'Designer' | 'Viewer')
                              }
                              className="px-2 py-1 text-xs border border-[#E2E8F0] rounded-lg bg-white font-semibold focus:outline-none focus:border-[#7C3AED]"
                            >
                              <option value="Designer">Designer</option>
                              <option value="Viewer">Viewer</option>
                            </select>

                            {/* Set / Reset Member Password */}
                            <button
                              onClick={() => {
                                setPasswordResetTarget(m);
                                setNewMemberPassword('');
                              }}
                              title="Set or reset login password for member"
                              className="p-1.5 rounded-lg border border-[#E2E8F0] text-[#7C3AED] hover:bg-[#7C3AED]/10 hover:border-[#7C3AED]/40 transition cursor-pointer"
                            >
                              <KeyRound className="w-3.5 h-3.5" />
                            </button>

                            {/* Status toggle */}
                            <button
                              onClick={() => handleStatusToggle(m._id, m.status)}
                              title={m.status === 'active' ? 'Deactivate Member' : 'Activate Member'}
                              className={`p-1.5 rounded-lg border transition cursor-pointer ${
                                m.status === 'active'
                                  ? 'border-[#E2E8F0] text-[#D97706] hover:bg-[#D97706]/10'
                                  : 'border-[#16A34A]/30 text-[#16A34A] hover:bg-[#16A34A]/10'
                              }`}
                            >
                              {m.status === 'active' ? (
                                <UserX className="w-3.5 h-3.5" />
                              ) : (
                                <UserCheck className="w-3.5 h-3.5" />
                              )}
                            </button>

                            {/* Delete member */}
                            <button
                              onClick={() => setDeleteTarget(m)}
                              title="Remove Member"
                              className="p-1.5 rounded-lg border border-[#E2E8F0] text-[#64748B] hover:text-[#DC2626] hover:border-[#DC2626]/30 hover:bg-[#DC2626]/10 transition cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {filteredMembers.length > memberPageSize && (
          <div className="p-4 border-t border-[#E2E8F0]">
            <Pagination
              currentPage={memberPage}
              totalPages={memberTotalPages}
              totalItems={filteredMembers.length}
              pageSize={memberPageSize}
              onPageChange={setMemberPage}
              onPageSizeChange={setMemberPageSize}
              pageSizeOptions={[5, 10, 20, 50]}
              itemName="members"
            />
          </div>
        )}
      </Card>
      )}

      {/* TAB 2: Pending & Unaccepted Invitations Section */}
      {activeTab === 'invitations' && (
      <Card className="p-0 overflow-hidden">
        <div className="px-5 py-3.5 border-b border-[#E2E8F0] bg-[#F8FAFC] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-[#1E293B] font-heading">
              Pending & Unaccepted Invitations
            </h2>
            <Badge variant="warning">{filteredInvitations.length} Pending</Badge>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-[#64748B]">
            <Clock className="w-3.5 h-3.5 text-[#B8860B]" />
            <span>Tokens expire in <strong>7 days</strong>. Copy invitation link anytime or click Resend to renew.</span>
          </div>
        </div>

        {/* Expiry Warning Banner if any links are expired */}
        {expiredInvitesCount > 0 && inviteStatusFilter !== 'expired' && (
          <div className="p-3 mx-4 mt-3 rounded-xl bg-amber-50 border border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-amber-900">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>
                <strong>{expiredInvitesCount} invitation link(s) have expired.</strong> You can generate a brand new 7-day link with 1 click.
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                setInviteStatusFilter('expired');
                setInvitePage(1);
              }}
              className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-amber-200/60 hover:bg-amber-200 text-amber-900 transition self-start sm:self-auto cursor-pointer"
            >
              Filter Expired Links ({expiredInvitesCount})
            </button>
          </div>
        )}

        {/* Invitation Search & Status Filter Bar */}
        {invitations.length > 0 && (
          <div className="p-3 border-b border-[#E2E8F0] bg-white flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-[#94A3B8] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search invitations by email or inviter..."
                value={inviteSearch}
                onChange={(e) => {
                  setInviteSearch(e.target.value);
                  setInvitePage(1);
                }}
                className="w-full pl-9 pr-4 py-1.5 text-xs bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg focus:outline-none focus:border-[#7C3AED] focus:bg-white transition"
              />
            </div>

            <div className="flex items-center gap-2">
              <Filter className="w-3.5 h-3.5 text-[#64748B]" />
              <select
                value={inviteStatusFilter}
                onChange={(e) => {
                  setInviteStatusFilter(e.target.value as any);
                  setInvitePage(1);
                }}
                className="px-2.5 py-1.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg text-xs font-semibold text-[#1E293B] focus:outline-none focus:border-[#7C3AED] cursor-pointer"
              >
                <option value="all">All Invitations ({invitations.length})</option>
                <option value="active">Active Valid Links ({activeInvitesCount})</option>
                <option value="expired">Expired Links ({expiredInvitesCount})</option>
              </select>
            </div>
          </div>
        )}

        {/* Mobile & Tablet Card View */}
        <div className="md:hidden divide-y divide-[#E2E8F0]">
          {loadingInvites ? (
            <div className="py-8 text-center text-xs text-[#64748B]">Loading pending invitations...</div>
          ) : filteredInvitations.length === 0 ? (
            <div className="py-8 text-center text-xs text-[#64748B]">
              <p className="font-semibold text-[#1E293B]">
                {inviteSearch || inviteStatusFilter !== 'all' ? 'No invitations match your filters' : 'No pending invitations'}
              </p>
              <p className="text-[11px] text-[#64748B] mt-1">
                {inviteSearch || inviteStatusFilter !== 'all'
                  ? 'Try clearing your search query or status filter'
                  : 'All invited team members have accepted or no new invitations have been sent yet.'}
              </p>
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
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-[#B8860B]/10 text-[#B8860B] font-bold flex items-center justify-center font-heading text-xs shrink-0">
                        {inv.email.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold text-xs text-[#1E293B] font-heading font-mono break-all">
                          {inv.email}
                        </div>
                        <div className="text-[11px] text-[#64748B]">
                          Invited by {inv.invitedBy?.name || 'Workspace Owner'}
                        </div>
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

                  {/* 1-Click Copy Box or Expired Renew Box */}
                  {expiry.isExpired ? (
                    <div className="p-2.5 rounded-lg bg-[#FEF2F2] border border-[#FCA5A5] flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-1.5 text-[#DC2626] font-semibold text-[11px]">
                        <Clock className="w-3.5 h-3.5 shrink-0" />
                        <span>Link Expired (7-day window passed)</span>
                      </div>
                      <Button
                        size="sm"
                        variant="gold"
                        disabled={isResending}
                        onClick={() => handleResendInvitation(inv)}
                        className="text-xs px-2.5 py-1 font-bold cursor-pointer"
                      >
                        <Sparkles className="w-3 h-3 mr-1" />
                        <span>{isResending ? 'Generating...' : 'Generate New Link'}</span>
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 bg-[#F8FAFC] p-1.5 rounded-lg border border-[#E2E8F0]">
                      <input
                        type="text"
                        readOnly
                        value={computedInviteUrl}
                        placeholder={computedInviteUrl ? '' : 'Click Renew to generate link'}
                        className="w-full px-2 py-1 text-[11px] rounded bg-white border border-[#E2E8F0] font-mono text-[#1E293B] select-all truncate focus:outline-none"
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          if (computedInviteUrl) {
                            copyToClipboard(computedInviteUrl, inv._id);
                          } else {
                            handleResendInvitation(inv);
                          }
                        }}
                        className="shrink-0 px-2 py-1 text-xs"
                      >
                        {copiedLink === inv._id ? (
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

                  {/* Expiry & Action Buttons */}
                  <div className="flex items-center justify-between pt-1 text-[11px] text-[#64748B]">
                    <div className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-[#94A3B8]" />
                      <span>{expiry.isExpired ? 'Expired' : `Exp: ${new Date(inv.expiresAt).toLocaleDateString()}`}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant={expiry.isExpired ? 'gold' : 'primary'}
                        disabled={isResending}
                        onClick={() => handleResendInvitation(inv)}
                        className="text-xs px-2.5 py-1 font-semibold cursor-pointer"
                        title={expiry.isExpired ? 'Generate fresh 7-day link' : 'Renew token for 7 days'}
                      >
                        <RotateCw
                          className={`w-3 h-3 mr-1 ${isResending ? 'animate-spin' : ''}`}
                        />
                        {isResending
                          ? 'Generating...'
                          : expiry.isExpired
                          ? 'Generate New Link'
                          : 'Renew Link'}
                      </Button>
                      <button
                        onClick={() => setDeleteInviteTarget(inv)}
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
              <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC] text-[11px] font-bold text-[#64748B] uppercase tracking-wider font-heading">
                <th className="py-3 px-5">Invited Member</th>
                <th className="py-3 px-5">Role</th>
                <th className="py-3 px-5">Invitation Link (Copy & Share Anytime)</th>
                <th className="py-3 px-5">Token Validity</th>
                <th className="py-3 px-5">Sent Date</th>
                <th className="py-3 px-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2E8F0]">
              {loadingInvites ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-[#64748B]">
                    Loading pending invitations...
                  </td>
                </tr>
              ) : filteredInvitations.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-[#64748B]">
                    <div className="space-y-1">
                      <p className="font-semibold text-[#1E293B]">
                        {inviteSearch ? 'No invitations match your search' : 'No pending invitations'}
                      </p>
                      <p className="text-[11px] text-[#64748B]">
                        {inviteSearch
                          ? 'Try clearing your search query'
                          : 'All invited team members have accepted or no new invitations have been sent yet.'}
                      </p>
                    </div>
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
                      <td className="py-3.5 px-5">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-[#B8860B]/10 text-[#B8860B] font-bold flex items-center justify-center font-heading text-xs">
                            {inv.email.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-semibold text-[#1E293B] font-heading font-mono">
                              {inv.email}
                            </div>
                            <div className="text-[11px] text-[#64748B]">
                              Invited by {inv.invitedBy?.name || 'Workspace Owner'}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-5">
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

                      {/* Direct Link Row Cell with 1-Click Copy / Renew */}
                      <td className="py-3.5 px-5 min-w-[280px]">
                        {expiry.isExpired ? (
                          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                            <Badge variant="danger" size="sm">
                              Expired (7 Days)
                            </Badge>
                            <Button
                              size="sm"
                              variant="gold"
                              disabled={isResending}
                              onClick={() => handleResendInvitation(inv)}
                              className="text-xs px-2.5 py-1 font-bold cursor-pointer shrink-0"
                              title="Generate fresh 7-day link for this member"
                            >
                              <Sparkles className="w-3 h-3 mr-1" />
                              <span>{isResending ? 'Generating...' : 'Generate New Link'}</span>
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 bg-[#F8FAFC] p-1.5 rounded-lg border border-[#E2E8F0]">
                            <input
                              type="text"
                              readOnly
                              value={computedInviteUrl}
                              placeholder={computedInviteUrl ? '' : 'Click Renew to generate link'}
                              className="w-full px-2 py-1 text-[11px] rounded bg-white border border-[#E2E8F0] font-mono text-[#1E293B] select-all truncate focus:outline-none"
                            />
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                if (computedInviteUrl) {
                                  copyToClipboard(computedInviteUrl, inv._id);
                                } else {
                                  handleResendInvitation(inv);
                                }
                              }}
                              className="shrink-0 px-2.5 py-1 text-xs"
                              title="Copy invitation link"
                            >
                              {copiedLink === inv._id ? (
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

                      <td className="py-3.5 px-5">
                        <div className="space-y-1">
                          <Badge variant={expiry.badgeVariant}>
                            <Clock className="w-3 h-3" />
                            {expiry.text}
                          </Badge>
                          <div className="text-[11px] text-[#64748B]">
                            {expiry.isExpired
                              ? 'Expired - Click Generate'
                              : `Expires: ${new Date(inv.expiresAt).toLocaleDateString()}`}
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-5 text-[#64748B]">
                        {new Date(inv.createdAt).toLocaleDateString()}
                      </td>

                      <td className="py-3.5 px-5 text-right">
                        <div className="inline-flex items-center gap-2">
                          <Button
                            size="sm"
                            variant={expiry.isExpired ? 'gold' : 'primary'}
                            disabled={isResending}
                            onClick={() => handleResendInvitation(inv)}
                            className="font-semibold shadow-xs cursor-pointer"
                            title={expiry.isExpired ? 'Generate fresh 7-day link' : 'Renew invitation token for 7 days'}
                          >
                            <RotateCw
                              className={`w-3.5 h-3.5 mr-1 ${isResending ? 'animate-spin' : ''}`}
                            />
                            {isResending
                              ? 'Generating...'
                              : expiry.isExpired
                              ? 'Generate New Link'
                              : 'Renew Link'}
                          </Button>

                          {/* Revoke Invitation */}
                          <button
                            onClick={() => setDeleteInviteTarget(inv)}
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

        {filteredInvitations.length > invitePageSize && (
          <div className="p-4 border-t border-[#E2E8F0]">
            <Pagination
              currentPage={invitePage}
              totalPages={inviteTotalPages}
              totalItems={filteredInvitations.length}
              pageSize={invitePageSize}
              onPageChange={setInvitePage}
              onPageSizeChange={setInvitePageSize}
              pageSizeOptions={[5, 10, 20]}
              itemName="invitations"
            />
          </div>
        )}
      </Card>
      )}

      {/* Set / Reset Member Password Modal */}
      {passwordResetTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/45 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl border border-[#E2E8F0] w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-150 p-6">
            <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F0] mb-4">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-[#7C3AED]/10 text-[#7C3AED]">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#1E293B] font-heading">
                    Set Member Login Password
                  </h3>
                  <p className="text-xs text-[#64748B]">
                    Enable direct /login for {passwordResetTarget.userId?.name}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setPasswordResetTarget(null)}
                className="text-[#64748B] hover:text-[#1E293B] p-1 rounded-lg hover:bg-[#F8FAFC]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveMemberPassword} className="space-y-4">
              <div className="p-3 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-xs space-y-1">
                <div className="text-[11px] text-[#64748B]">Member Email:</div>
                <div className="font-semibold text-[#1E293B] font-mono">
                  {passwordResetTarget.userId?.email}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1E293B] font-heading mb-1">
                  New Password *
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={newMemberPassword}
                    onChange={(e) => setNewMemberPassword(e.target.value)}
                    placeholder="Enter password (minimum 8 characters)"
                    className="w-full px-3 py-2 text-xs border border-[#E2E8F0] rounded-lg focus:outline-none focus:border-[#7C3AED] font-mono"
                  />
                </div>
                <p className="text-[11px] text-[#64748B] mt-1">
                  Once set, the member can immediately log in at <strong>/login</strong> using their email and this password.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setPasswordResetTarget(null)}
                  disabled={savingPassword}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  disabled={savingPassword}
                >
                  <Lock className="w-3.5 h-3.5 mr-1" />
                  {savingPassword ? 'Saving Password...' : 'Save & Enable Login'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Quick Invite Modal */}
      {isInviteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/45 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl border border-[#E2E8F0] w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-150 p-6">
            <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F0] mb-4">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-[#7C3AED]/10 text-[#7C3AED]">
                  <MailPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#1E293B] font-heading">
                    Invite Team Member
                  </h3>
                  <p className="text-xs text-[#64748B]">Token will be valid strictly for 7 days</p>
                </div>
              </div>
              <button
                onClick={() => setIsInviteModalOpen(false)}
                className="text-[#64748B] hover:text-[#1E293B] p-1 rounded-lg hover:bg-[#F8FAFC]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSendInvite} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#1E293B] font-heading mb-1">
                  Business Email Address *
                </label>
                <input
                  type="email"
                  required
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="e.g. designer@jewellerycraft.com"
                  className="w-full px-3 py-2 text-xs border border-[#E2E8F0] rounded-lg focus:outline-none focus:border-[#7C3AED]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1E293B] font-heading mb-1">
                  Assign Workspace Role *
                </label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as 'Designer' | 'Viewer')}
                  className="w-full px-3 py-2 text-xs border border-[#E2E8F0] rounded-lg bg-white font-semibold focus:outline-none focus:border-[#7C3AED]"
                >
                  <option value="Designer">Designer (Watermark Editor & Processing)</option>
                  <option value="Viewer">Viewer (Catalogue & Preview Only)</option>
                </select>
                <p className="text-[11px] text-[#64748B] mt-1">
                  Workspace members are strictly restricted to Designer or Viewer roles.
                </p>
              </div>

              <div className="p-3 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-xs space-y-1">
                <div className="flex items-center gap-1.5 font-semibold text-[#1E293B]">
                  <Clock className="w-3.5 h-3.5 text-[#B8860B]" />
                  <span>7-Day Expiration Guarantee</span>
                </div>
                <p className="text-[11px] text-[#64748B]">
                  The invited member has 7 days to accept. The invitation link will be shown in the table so you can copy and share it anytime.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsInviteModalOpen(false)}
                  disabled={sendingInvite}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  disabled={sendingInvite}
                >
                  <Send className="w-3.5 h-3.5 mr-1" />
                  {sendingInvite ? 'Generating Invite...' : 'Generate & Send Invite'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirm Member Deletion Modal */}
      <ConfirmDeleteModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDeleteMember}
        title="Remove Team Member?"
        description="Are you sure you want to remove this member from your company workspace? They will immediately lose access to all jewellery designs."
        itemName={deleteTarget?.userId?.name ? `${deleteTarget.userId.name} (${deleteTarget.userId.email})` : deleteTarget?.userId?.email}
        confirmText="Remove Member"
        loading={deleting}
      />

      {/* Confirm Invitation Revoke Modal */}
      <ConfirmDeleteModal
        isOpen={!!deleteInviteTarget}
        onClose={() => setDeleteInviteTarget(null)}
        onConfirm={confirmDeleteInvitation}
        title="Revoke Workspace Invitation?"
        description="Are you sure you want to cancel this pending invitation? The invite link will immediately become invalid and unusable."
        itemName={deleteInviteTarget?.email}
        confirmText="Revoke Invitation"
        loading={deleting}
      />

      {/* Generated New Link Modal (for newly invited or expired renewed links) */}
      {newGeneratedLinkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/45 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl border border-[#E2E8F0] w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-150 p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F0]">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#7C3AED]/20 to-[#B8860B]/20 text-[#7C3AED] flex items-center justify-center shrink-0">
                  <Sparkles className="w-5 h-5 text-[#7C3AED]" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#1E293B] font-heading">
                    {newGeneratedLinkModal.isRenewed
                      ? 'New Invitation Link Generated!'
                      : 'Workspace Invitation Created!'}
                  </h3>
                  <p className="text-xs text-[#64748B]">
                    Fresh 7-day access token issued for <strong className="font-mono text-[#1E293B]">{newGeneratedLinkModal.email}</strong>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setNewGeneratedLinkModal(null)}
                className="text-[#64748B] hover:text-[#1E293B] p-1.5 rounded-lg hover:bg-[#F8FAFC] transition cursor-pointer"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-2.5">
              <div className="flex items-center justify-between text-xs font-semibold text-[#1E293B]">
                <span>Direct Invitation URL</span>
                <span className="text-[11px] text-[#16A34A] font-bold flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Copied to clipboard!
                </span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={newGeneratedLinkModal.url}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-[#E2E8F0] bg-white font-mono text-[#1E293B] select-all focus:outline-none focus:border-[#7C3AED]"
                />
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => copyToClipboard(newGeneratedLinkModal.url, 'modal-link')}
                  className="shrink-0 cursor-pointer"
                >
                  {copiedLink === 'modal-link' ? (
                    <>
                      <Check className="w-3.5 h-3.5 mr-1" /> Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 mr-1" /> Copy Link
                    </>
                  )}
                </Button>
              </div>
            </div>

            <div className="space-y-1.5 text-xs text-[#64748B] bg-amber-50 border border-amber-200/70 p-3.5 rounded-xl">
              <div className="flex items-center gap-1.5 font-bold text-amber-900">
                <Clock className="w-4 h-4 text-amber-700 shrink-0" />
                <span>Valid for strictly 7 days</span>
              </div>
              <p className="text-[11px] text-amber-800 leading-relaxed">
                You can copy and send this link directly to the member via WhatsApp, Email, or Slack. If it expires in the future, you can renew and generate a fresh link anytime from this page.
              </p>
            </div>

            <div className="flex justify-end pt-1">
              <Button
                variant="primary"
                size="md"
                onClick={() => setNewGeneratedLinkModal(null)}
                className="cursor-pointer"
              >
                Done
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
