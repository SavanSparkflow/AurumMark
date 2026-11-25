import React, { useState, useEffect } from 'react';
import { FileText, Clock, RotateCw, Shield, Search, Filter } from 'lucide-react';
import { dashboardApi } from '../../api/index.js';
import { ActivityLogItem } from '../../types/index.js';
import { Card, Button, Badge, Pagination } from '../../components/common/index.js';

export const ActivityLogsPage: React.FC = () => {
  const [logs, setLogs] = useState<ActivityLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterAction, setFilterAction] = useState('all');

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await dashboardApi.getActivity();
      setLogs(res.data.data || []);
    } catch (err) {
      console.error('Failed to load logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const uniqueActions = Array.from(new Set(logs.map((l) => l.action))).sort();

  const filteredLogs = logs.filter((log) => {
    const matchesSearch =
      !searchQuery ||
      log.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.resourceType.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (log.actorId?.name && log.actorId.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (log.ipAddress && log.ipAddress.includes(searchQuery));
    const matchesAction = filterAction === 'all' || log.action === filterAction;
    return matchesSearch && matchesAction;
  });

  const totalPages = Math.ceil(filteredLogs.length / pageSize) || 1;
  const paginatedLogs = filteredLogs.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[#1E293B] font-heading">
            Company Activity & Audit Logs
          </h1>
          <p className="text-xs text-[#64748B] mt-0.5">
            Full compliance audit trail of watermark operations, member updates, and file downloads.
          </p>
        </div>

        <Button size="sm" variant="outline" onClick={fetchLogs} className="self-start sm:self-auto shrink-0">
          <RotateCw className="w-3.5 h-3.5 mr-1" /> Refresh
        </Button>
      </div>

      {/* Search and Action Filter */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#64748B]" />
          <input
            type="text"
            placeholder="Search by action, user, or IP..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPage(1);
            }}
            className="w-full pl-9 pr-4 py-2 text-xs border border-[#E2E8F0] rounded-xl bg-white focus:outline-none focus:border-[#7C3AED]"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
          <Filter className="w-4 h-4 text-[#64748B] shrink-0" />
          <select
            value={filterAction}
            onChange={(e) => {
              setFilterAction(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 text-xs border border-[#E2E8F0] rounded-xl bg-white focus:outline-none focus:border-[#7C3AED] font-semibold text-[#1E293B] w-full sm:w-auto"
          >
            <option value="all">All Actions ({logs.length})</option>
            {uniqueActions.map((act) => (
              <option key={act} value={act}>
                {act}
              </option>
            ))}
          </select>
        </div>
      </div>

      <Card className="p-0 overflow-hidden">
        {/* Mobile & Tablet Card View */}
        <div className="md:hidden divide-y divide-[#E2E8F0]">
          {loading ? (
            <div className="py-10 text-center text-xs text-[#64748B]">Loading audit trail...</div>
          ) : paginatedLogs.length === 0 ? (
            <div className="py-10 text-center text-xs text-[#64748B]">
              {searchQuery || filterAction !== 'all'
                ? 'No activity logs match your filter criteria.'
                : 'No activity logs recorded.'}
            </div>
          ) : (
            paginatedLogs.map((log) => (
              <div key={log._id} className="p-3.5 space-y-2 hover:bg-[#F8FAFC]/60 transition">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-xs text-[#1E293B] font-mono break-all">{log.action}</span>
                  <Badge variant="primary" size="sm">
                    {log.resourceType}
                  </Badge>
                </div>
                <div className="flex items-center justify-between text-xs text-[#64748B]">
                  <span className="font-medium text-[#1E293B]">{log.actorId?.name || 'System Actor'}</span>
                  <span className="font-mono text-[11px] text-[#64748B]">{log.ipAddress || '127.0.0.1'}</span>
                </div>
                <div className="flex items-center gap-1 text-[11px] text-[#94A3B8]">
                  <Clock className="w-3 h-3 text-[#94A3B8]" />
                  <span>{new Date(log.createdAt).toLocaleString()}</span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Desktop Table View */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs min-w-[650px]">
            <thead>
              <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC] text-[11px] font-bold text-[#64748B] uppercase tracking-wider font-heading">
                <th className="py-3 px-5">Event Action</th>
                <th className="py-3 px-5">Target Resource</th>
                <th className="py-3 px-5">Actor</th>
                <th className="py-3 px-5">IP Address</th>
                <th className="py-3 px-5 text-right">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2E8F0]">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-[#64748B]">
                    Loading audit trail...
                  </td>
                </tr>
              ) : paginatedLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-[#64748B]">
                    {searchQuery || filterAction !== 'all'
                      ? 'No activity logs match your filter criteria.'
                      : 'No activity logs recorded.'}
                  </td>
                </tr>
              ) : (
                paginatedLogs.map((log) => (
                  <tr key={log._id} className="hover:bg-[#F8FAFC]/60 transition">
                    <td className="py-3 px-5">
                      <span className="font-semibold text-[#1E293B] font-mono">{log.action}</span>
                    </td>
                    <td className="py-3 px-5">
                      <Badge variant="primary" size="sm">
                        {log.resourceType}
                      </Badge>
                    </td>
                    <td className="py-3 px-5 text-[#64748B]">
                      {log.actorId?.name || 'System Actor'}
                    </td>
                    <td className="py-3 px-5 text-[#64748B] font-mono text-[11px]">
                      {log.ipAddress || '127.0.0.1'}
                    </td>
                    <td className="py-3 px-5 text-right text-[#64748B]">
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        {filteredLogs.length > pageSize && (
          <div className="px-5 pb-4">
            <Pagination
              currentPage={page}
              totalPages={totalPages}
              totalItems={filteredLogs.length}
              pageSize={pageSize}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
              pageSizeOptions={[10, 15, 25, 50]}
              itemName="audit logs"
            />
          </div>
        )}
      </Card>
    </div>
  );
};
