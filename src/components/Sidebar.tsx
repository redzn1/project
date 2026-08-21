import React, { useState, useMemo } from 'react';
import {
  MessageSquare,
  Plus,
  Search,
  Trash2,
  Edit2,
  Pin,
  Settings,
  X,
  Check,
  LogOut,
  Terminal,
  LogIn,
  Volume2,
} from 'lucide-react';
import { Conversation, AuthUser } from '../types';

interface SidebarProps {
  conversations: Conversation[];
  activeConversationId: string;
  onSelectConversation: (id: string) => void;
  onNewChat: () => void;
  onDeleteConversation: (id: string) => void;
  onRenameConversation: (id: string, newTitle: string) => void;
  onPinConversation: (id: string) => void;
  onOpenSettings: () => void;
  onOpenAuth?: () => void;
  onNavigateToAdmin: () => void;
  isOpen: boolean;
  onCloseMobile: () => void;
  theme: 'dark' | 'light' | 'slate';
  onToggleTheme: () => void;
  currentUser?: AuthUser | null;
  onLogout?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  conversations,
  activeConversationId,
  onSelectConversation,
  onNewChat,
  onDeleteConversation,
  onRenameConversation,
  onPinConversation,
  onOpenSettings,
  onOpenAuth,
  onNavigateToAdmin,
  isOpen,
  onCloseMobile,
  currentUser,
  onLogout,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const isDevUser = Boolean(
    currentUser?.email === 'dev@lynxie.ai' ||
    currentUser?.isDev ||
    (typeof window !== 'undefined' && localStorage.getItem('lynxiee_dev_auth') === 'true')
  );

  // Filter conversations
  const filteredConversations = useMemo(() => {
    let list = conversations;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((c) => c.title.toLowerCase().includes(q));
    }
    return list;
  }, [conversations, searchQuery]);

  // Group conversations by date
  const groups = useMemo(() => {
    const now = Date.now();
    const oneDay = 24 * 60 * 60 * 1000;

    const pinned: Conversation[] = [];
    const today: Conversation[] = [];
    const yesterday: Conversation[] = [];
    const lastWeek: Conversation[] = [];
    const older: Conversation[] = [];

    filteredConversations.forEach((c) => {
      if (c.pinned) {
        pinned.push(c);
        return;
      }
      const age = now - (c.updatedAt || c.createdAt);
      if (age < oneDay) {
        today.push(c);
      } else if (age < 2 * oneDay) {
        yesterday.push(c);
      } else if (age < 7 * oneDay) {
        lastWeek.push(c);
      } else {
        older.push(c);
      }
    });

    return { pinned, today, yesterday, lastWeek, older };
  }, [filteredConversations]);

  const handleStartRename = (conv: Conversation, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(conv.id);
    setEditTitle(conv.title);
  };

  const handleSaveRename = (id: string, e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (editTitle.trim()) {
      onRenameConversation(id, editTitle.trim());
    }
    setEditingId(null);
  };

  const handleConfirmDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onDeleteConversation(id);
    setDeleteConfirmId(null);
  };

  const renderConversationItem = (conv: Conversation) => {
    const isActive = conv.id === activeConversationId;
    const isEditing = editingId === conv.id;
    const isDeleting = deleteConfirmId === conv.id;

    if (isEditing) {
      return (
        <form
          key={conv.id}
          onSubmit={(e) => handleSaveRename(conv.id, e)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#0e111a] border border-white/30 shadow-md"
          onClick={(e) => e.stopPropagation()}
        >
          <input
            type="text"
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            className="w-full bg-transparent text-xs text-white focus:outline-none"
            autoFocus
            onBlur={() => handleSaveRename(conv.id)}
          />
          <button type="submit" className="text-emerald-400 p-1 hover:text-emerald-300">
            <Check className="w-3.5 h-3.5" />
          </button>
        </form>
      );
    }

    return (
      <div
        key={conv.id}
        onClick={() => {
          onSelectConversation(conv.id);
          if (window.innerWidth < 1024) onCloseMobile();
        }}
        className={`group relative flex items-center justify-between px-3 py-2.5 rounded-xl cursor-pointer transition-all text-xs select-none ${
          isActive
            ? 'bg-white/10 text-white font-medium border border-white/20 shadow-md'
            : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'
        }`}
      >
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <MessageSquare
            className={`w-3.5 h-3.5 shrink-0 ${
              isActive ? 'text-slate-200' : 'text-slate-500 group-hover:text-slate-300'
            }`}
          />
          <span className="truncate">{conv.title || 'Percakapan Baru'}</span>
        </div>

        {/* Action icons on hover or active */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity ml-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onPinConversation(conv.id);
            }}
            className={`p-1 rounded hover:bg-white/10 ${conv.pinned ? 'text-slate-200' : 'text-slate-400 hover:text-white'}`}
            title={conv.pinned ? 'Lepas Sematan' : 'Sematkan'}
          >
            <Pin className="w-3 h-3" />
          </button>

          <button
            onClick={(e) => handleStartRename(conv, e)}
            className="p-1 rounded hover:bg-white/10 text-slate-400 hover:text-white"
            title="Ubah Nama"
          >
            <Edit2 className="w-3 h-3" />
          </button>

          {isDeleting ? (
            <button
              onClick={(e) => handleConfirmDelete(conv.id, e)}
              className="p-1 rounded bg-rose-600 text-white hover:bg-rose-500"
              title="Konfirmasi Hapus"
            >
              <Check className="w-3 h-3" />
            </button>
          ) : (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setDeleteConfirmId(conv.id);
                setTimeout(() => setDeleteConfirmId(null), 3000);
              }}
              className="p-1 rounded hover:bg-white/10 text-slate-400 hover:text-rose-400"
              title="Hapus"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 bg-black/75 backdrop-blur-sm z-30 lg:hidden"
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed top-0 bottom-0 left-0 w-72 bg-[#090b10]/95 backdrop-blur-2xl border-r border-white/10 z-30 flex flex-col transition-transform duration-200 lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Top Header & New Chat Button */}
        <div className="p-3.5 border-b border-white/10 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-xl bg-[#101420] border border-white/15 flex items-center justify-center p-1 shadow-md">
                <img src="/logo.svg" alt="LYNXIEE" className="w-full h-full object-contain" />
              </div>
              <span className="font-bold text-xs text-white tracking-wide">LYNXIEE AI</span>
            </div>
            <button
              onClick={onCloseMobile}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 lg:hidden cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <button
            onClick={() => {
              onNewChat();
              if (window.innerWidth < 1024) onCloseMobile();
            }}
            className="w-full py-2.5 px-3 rounded-xl bg-white/10 hover:bg-white/15 text-white border border-white/20 text-xs font-semibold flex items-center justify-center gap-2 transition-all shadow-md cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Percakapan Baru</span>
          </button>

          {/* Search Box */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Cari percakapan..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-[#06070a] border border-white/10 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-white/30"
            />
          </div>
        </div>

        {/* Conversation List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-3.5">
          {/* Pinned Group */}
          {groups.pinned.length > 0 && (
            <div className="space-y-1">
              <div className="px-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                <Pin className="w-2.5 h-2.5" />
                <span>Disematkan</span>
              </div>
              {groups.pinned.map(renderConversationItem)}
            </div>
          )}

          {/* Today Group */}
          {groups.today.length > 0 && (
            <div className="space-y-1">
              <div className="px-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                Hari Ini
              </div>
              {groups.today.map(renderConversationItem)}
            </div>
          )}

          {/* Yesterday Group */}
          {groups.yesterday.length > 0 && (
            <div className="space-y-1">
              <div className="px-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                Kemarin
              </div>
              {groups.yesterday.map(renderConversationItem)}
            </div>
          )}

          {/* Last Week Group */}
          {groups.lastWeek.length > 0 && (
            <div className="space-y-1">
              <div className="px-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                7 Hari Terakhir
              </div>
              {groups.lastWeek.map(renderConversationItem)}
            </div>
          )}

          {/* Older Group */}
          {groups.older.length > 0 && (
            <div className="space-y-1">
              <div className="px-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                Sebelumnya
              </div>
              {groups.older.map(renderConversationItem)}
            </div>
          )}

          {filteredConversations.length === 0 && (
            <div className="text-center py-10 text-xs text-slate-500">
              Belum ada riwayat percakapan.
            </div>
          )}
        </div>

        {/* Bottom Bar: User Card & Settings */}
        <div className="p-3 border-t border-white/10 space-y-2 bg-[#06070a]">
          {currentUser ? (
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#0e111a] border border-white/10 shadow-sm">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-7 h-7 rounded-lg bg-white/10 border border-white/20 flex items-center justify-center text-white text-xs font-bold shrink-0">
                  {currentUser.name ? currentUser.name.charAt(0) : 'U'}
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-white truncate">
                    {currentUser.name}
                  </div>
                  <div className="text-[10px] text-slate-400 truncate font-mono">
                    {currentUser.email}
                  </div>
                </div>
              </div>

              {onLogout && (
                <button
                  onClick={onLogout}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-white/10 transition-colors cursor-pointer"
                  title="Logout"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ) : (
            onOpenAuth && (
              <button
                onClick={() => {
                  onOpenAuth();
                  if (window.innerWidth < 1024) onCloseMobile();
                }}
                className="w-full p-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white border border-white/20 text-xs font-medium flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Masuk / Sinkronkan Akun</span>
              </button>
            )
          )}

          <div className="flex items-center gap-2">
            {/* Developer shortcut */}
            {isDevUser && (
              <button
                onClick={() => {
                  onNavigateToAdmin();
                  if (window.innerWidth < 1024) onCloseMobile();
                }}
                className="flex-1 py-2 px-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-slate-200 border border-white/20 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                title="Developer Admin Console"
              >
                <Terminal className="w-3.5 h-3.5" />
                <span>Dev Portal</span>
              </button>
            )}

            <button
              onClick={() => {
                onOpenSettings();
                if (window.innerWidth < 1024) onCloseMobile();
              }}
              className="flex-1 py-2 px-2.5 rounded-xl bg-[#0e111a] hover:bg-[#141824] text-slate-300 hover:text-white border border-white/10 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <Settings className="w-3.5 h-3.5 text-slate-400" />
              <span>Pengaturan</span>
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};
