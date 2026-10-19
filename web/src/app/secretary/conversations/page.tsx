'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  conversationApi,
  Conversation,
  ConversationMessage,
  AppointmentSummary,
} from '@/lib/api/secretaryApi';

const MESSAGES_POLL_MS = 30000;

export default function SecretaryConversations() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [summary, setSummary] = useState<AppointmentSummary | null>(null);
  const [draft, setDraft] = useState('');
  const [isLoadingList, setIsLoadingList] = useState(true);
  const [isLoadingThread, setIsLoadingThread] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [threadError, setThreadError] = useState<string | null>(null);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [hoveredMessage, setHoveredMessage] = useState<{
    id: string;
    top: number;
    left: number;
    isOwn: boolean;
  } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const userStr = localStorage.getItem('user');
        if (userStr) {
          const user = JSON.parse(userStr);
          if (user?.id) {
            setCurrentUserId(user.id);
          }
        }
      } catch {
        // ignore malformed user data
      }
    }
  }, []);

  const fetchConversations = useCallback(async () => {
    const response = await conversationApi.getConversations();
    if (response.success && response.data) {
      const getActivityTime = (conversation: Conversation) => {
        const timestamp = conversation.last_message_sent_at ?? conversation.updated_at;
        if (!timestamp) return Number.NEGATIVE_INFINITY;
        const activityTime = Date.parse(timestamp);
        return Number.isNaN(activityTime) ? Number.NEGATIVE_INFINITY : activityTime;
      };
      setConversations(
        [...response.data].sort((a, b) => getActivityTime(b) - getActivityTime(a))
      );
      setListError(null);
    } else {
      setListError(response.error || 'Failed to fetch conversations');
    }
    setIsLoadingList(false);
  }, []);

  const fetchThread = useCallback(async (conversationId: string, patientId?: string) => {
    setIsLoadingThread(true);
    setThreadError(null);

    try {
      let summaryResponse;
      if (patientId) {
        // For patients without conversations, use patient ID to get summary
        summaryResponse = await conversationApi.getAppointmentSummaryByPatientId(patientId);
      } else {
        // For existing conversations, use conversation ID
        summaryResponse = await conversationApi.getAppointmentSummary(conversationId);
      }

      if (summaryResponse.success && summaryResponse.data) {
        setSummary(summaryResponse.data);
        setSummaryError(null);
      } else {
        setSummaryError(summaryResponse.error || 'Failed to fetch appointment summary');
      }

      // Only fetch messages if we have a conversation ID
      if (!patientId) {
        const messagesResponse = await conversationApi.getMessages(conversationId);
        if (messagesResponse.success && messagesResponse.data) {
          setMessages(messagesResponse.data);
        } else {
          setThreadError(messagesResponse.error || 'Failed to fetch messages');
        }

        // Mark incoming messages as read, then refresh badges
        const readResponse = await conversationApi.markAsRead(conversationId);
        if (readResponse.success) {
          fetchConversations();
        }
      } else {
        // No messages yet for new conversation
        setMessages([]);
      }
    } catch {
      setThreadError('Network error occurred');
    } finally {
      setIsLoadingThread(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  // Keep the thread and unread badges current while the page is open
  useEffect(() => {
    const interval = setInterval(() => {
      fetchConversations();
      if (selectedId) {
        conversationApi.getMessages(selectedId).then((response) => {
          if (response.success && response.data) {
            setMessages(response.data);
          }
        });
      }
    }, MESSAGES_POLL_MS);
    return () => clearInterval(interval);
  }, [selectedId, fetchConversations]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, selectedId]);

  const handleSelectConversation = async (conversation: Conversation) => {
    setSelectedConversation(conversation);
    
    // If conversation doesn't exist (patient without messages), create one first
    if (!conversation.id) {
      try {
        const createResponse = await conversationApi.createConversation({ patientId: conversation.patient_id });
        if (createResponse.success && createResponse.data) {
          // Select the newly created conversation
          const newConversation = createResponse.data;
          setSelectedId(newConversation.id);
          setSelectedConversation(newConversation);
          setSummary(null);
          setSummaryError(null);
          // Fetch thread for the new conversation
          fetchThread(newConversation.id);
          // Refresh conversations list to update the UI
          fetchConversations();
        } else {
          setThreadError(createResponse.error || 'Failed to create conversation');
        }
      } catch {
        setThreadError('Network error occurred');
      }
    } else {
      setSelectedId(conversation.id);
      setSummary(null);
      setSummaryError(null);
      fetchThread(conversation.id);
    }
  };

  const handleSend = async () => {
    const message = draft.trim();
    if (!selectedId || !message || isSending) {
      return;
    }

    setIsSending(true);

    try {
      const response = await conversationApi.sendMessage(selectedId, message);

      if (response.success) {
        setDraft('');
        const messagesResponse = await conversationApi.getMessages(selectedId);
        if (messagesResponse.success && messagesResponse.data) {
          setMessages(messagesResponse.data);
        } else {
          setThreadError(messagesResponse.error || 'Failed to refresh messages');
        }
        // Update the preview/unread state in the conversation list
        fetchConversations();
      } else {
        setThreadError(response.error || 'Failed to send message');
      }
    } catch {
      setThreadError('Network error occurred');
    } finally {
      setIsSending(false);
    }
  };

  const getPatientName = (conversation: Conversation) =>
    `${conversation.patient_first_name ?? ''} ${conversation.patient_last_name ?? ''}`.trim() ||
    'Unknown patient';

  const getDoctorName = (conversation: Conversation) =>
    conversation.doctor_first_name && conversation.doctor_last_name
      ? `Dr. ${conversation.doctor_last_name}`
      : 'Assistant';

  const getDoctorLabel = (conversation: Conversation) =>
    `${getDoctorName(conversation)}${conversation.practice_name ? ` • ${conversation.practice_name}` : ''}`;

  const formatTime = (dateString?: string | null) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const messageDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

    // Check if message was sent on a previous day
    if (messageDate < today) {
      // Format as "Monday 11:38 PM"
      const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const weekday = weekdays[date.getDay()];
      const hours = date.getHours();
      const minutes = date.getMinutes().toString().padStart(2, '0');
      const ampm = hours >= 12 ? 'PM' : 'AM';
      const displayHours = hours % 12 || 12;
      return `${weekday} ${displayHours}:${minutes} ${ampm}`;
    } else {
      // Same day - format as time only (e.g., "11:38 PM")
      const hours = date.getHours();
      const minutes = date.getMinutes().toString().padStart(2, '0');
      const ampm = hours >= 12 ? 'PM' : 'AM';
      const displayHours = hours % 12 || 12;
      return `${displayHours}:${minutes} ${ampm}`;
    }
  };

  const formatListTime = (dateString?: string | null) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    return isToday
      ? date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
      : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const formatAppointmentDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  return (
    <div className="space-y-4">
      {/* Errors */}
      {listError && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          {listError}
        </div>
      )}

      {/* Three-column chat layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr_320px] gap-4 h-[calc(100vh-120px)] min-h-[560px]">
        {/* Column 1: Conversation list */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100">
            <h2 className="text-sm font-bold text-slate-900">Chats</h2>
            <p className="text-xs text-slate-500">{conversations.length} conversation{conversations.length === 1 ? '' : 's'}</p>
          </div>
          <div className="flex-1 overflow-y-auto">
            {isLoadingList ? (
              <div className="p-4 text-xs text-slate-500">Loading conversations…</div>
            ) : conversations.length === 0 ? (
              <div className="p-4 text-xs text-slate-500">No conversations yet.</div>
            ) : (
              conversations.map((conversation) => {
                const unreadCountValue = Number(conversation.unread_count);
                const unreadCount = Number.isFinite(unreadCountValue) ? unreadCountValue : 0;
                return (
                  <button
                    key={conversation.patient_id}
                    onClick={() => handleSelectConversation(conversation)}
                    className={`w-full text-left px-4 py-3 border-b border-slate-100 transition-all duration-200 cursor-pointer bg-white hover:bg-slate-100 ${
                      selectedConversation?.patient_id === conversation.patient_id ? 'bg-blue-50' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900 truncate">
                          {getPatientName(conversation)}
                        </p>
                        {conversation.last_message_preview ? (
                          <p className={`text-xs mt-1 truncate ${unreadCount > 0 ? 'text-slate-700 font-medium' : 'text-slate-500'}`}>
                            {conversation.last_message_sender_user_id === currentUserId ? 'You: ' : ''}
                            {conversation.last_message_preview}
                          </p>
                        ) : (
                          <p className="text-xs mt-1 text-slate-400 italic">No messages yet</p>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <span className="text-[11px] text-slate-400">
                          {formatListTime(conversation.last_message_sent_at)}
                        </span>
                        {unreadCount > 0 && (
                          <span className="bg-[#1b5eb8] text-white text-[11px] font-bold rounded-full min-w-[20px] h-5 px-1.5 flex items-center justify-center">
                            {unreadCount}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Column 2: Conversation thread */}
        <div className="min-w-0 bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col overflow-hidden">
          {selectedConversation ? (
            <>
              <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-bold text-slate-900">{getPatientName(selectedConversation)}</h2>
                </div>
                <span className="material-symbols-outlined text-[20px] text-slate-400">chat</span>
              </div>

              {threadError && (
                <div className="mx-4 mt-3 bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-xs">
                  {threadError}
                </div>
              )}

              <div
                className="min-w-0 flex-1 overflow-y-auto overflow-x-hidden px-4 py-4 space-y-3"
                onScroll={() => setHoveredMessage(null)}
              >
                {isLoadingThread && messages.length === 0 ? (
                  <p className="text-xs text-slate-500 text-center">Loading messages…</p>
                ) : messages.length === 0 ? (
                  <p className="text-xs text-slate-500 text-center py-8">No messages yet. Say hello to start the conversation.</p>
                ) : (
                  messages.map((message) => {
                    const isOwn = message.sender_user_id === currentUserId;
                    const isHovered = hoveredMessage?.id === message.id;
                    return (
                      <div key={message.id} className={`flex w-full min-w-0 items-end gap-2 ${isOwn ? 'justify-end' : 'justify-start'}`}>
                        {!isOwn && (
                          <div className="w-9 h-9 rounded-full bg-slate-200 flex items-center justify-center shrink-0">
                            <span className="material-symbols-outlined text-slate-500 text-[20px]">person</span>
                          </div>
                        )}
                        <div className={`relative flex min-w-0 flex-1 flex-col ${isOwn ? 'items-end' : 'items-start'}`}>
                          <div
                            className={`w-fit min-w-0 max-w-[75%] rounded-2xl px-4 py-2 ${
                              isOwn
                                ? 'bg-[#1b5eb8] text-white rounded-br-md'
                                : 'bg-slate-100 text-slate-900 rounded-bl-md'
                            }`}
                            onMouseEnter={(event) => {
                              const bounds = event.currentTarget.getBoundingClientRect();
                              setHoveredMessage({
                                id: message.id,
                                top: bounds.top + bounds.height / 2,
                                left: isOwn ? bounds.right + 8 : bounds.left - 8,
                                isOwn,
                              });
                            }}
                            onMouseLeave={() => setHoveredMessage(null)}
                          >
                            <p className="text-sm text-justify whitespace-pre-wrap break-words">{message.message}</p>
                          </div>
                          {isHovered && typeof document !== 'undefined' && createPortal(
                            <div
                              className="fixed z-[1000] flex -translate-y-1/2 items-center rounded-lg bg-slate-800 px-3 py-1.5 text-[11px] text-white shadow-lg whitespace-nowrap"
                              style={{
                                top: hoveredMessage?.top ?? 0,
                                left: hoveredMessage?.left ?? 0,
                                transform: `translate(${hoveredMessage?.isOwn ? '0' : '-100%'}, -50%)`,
                                pointerEvents: 'none',
                              }}
                            >
                              {formatTime(message.sent_at)}
                              {isOwn && (message.read_at ? ' • Read' : ' • Delivered')}
                            </div>,
                            document.body
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Composer */}
              <div className="border-t border-slate-100 p-3">
                <div className="flex items-end gap-2">
                  <textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSend();
                      }
                    }}
                    placeholder="Type your message…"
                    rows={1}
                    className="flex-1 resize-none border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#1b5eb8]/30 focus:border-[#1b5eb8]"
                  />
                  <button
                    onClick={handleSend}
                    disabled={!draft.trim() || isSending}
                    className="bg-[#1b5eb8] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#1a4f9e] disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
                  >
                    {isSending ? 'Sending…' : 'Send'}
                    <span className="material-symbols-outlined text-[18px]">send</span>
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
              <span className="material-symbols-outlined text-5xl text-slate-300 mb-3">chat</span>
              <p className="text-sm text-slate-600 font-medium">Select a conversation</p>
              <p className="text-xs text-slate-500 mt-1">Choose a patient chat from the list to view the message thread.</p>
            </div>
          )}
        </div>

        {/* Column 3: Patient info sheet */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100">
            <h2 className="text-sm font-bold text-slate-900">Patient Info</h2>
            <p className="text-xs text-slate-500">Read-only appointment details</p>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {selectedConversation ? (
              <>
                {summaryError && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-xs">
                    {summaryError}
                  </div>
                )}
                {!summary && !summaryError ? (
                  <p className="text-xs text-slate-500">Loading patient details…</p>
                ) : summary ? (
                  <>
                    {/* Patient block */}
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">Patient</p>
                      <p className="text-sm font-semibold text-slate-900">
                        {summary.patient.firstName} {summary.patient.middleName ? `${summary.patient.middleName} ` : ''}
                        {summary.patient.lastName}
                      </p>
                      <dl className="mt-2 space-y-1">
                        {summary.patient.phone && (
                          <div className="flex items-center gap-2 text-xs text-slate-600">
                            <span className="material-symbols-outlined text-[16px] text-slate-400">call</span>
                            {summary.patient.phone}
                          </div>
                        )}
                        {summary.patient.email && (
                          <div className="flex items-center gap-2 text-xs text-slate-600 break-all">
                            <span className="material-symbols-outlined text-[16px] text-slate-400">mail</span>
                            {summary.patient.email}
                          </div>
                        )}
                        {summary.patient.dateOfBirth && (
                          <div className="flex items-center gap-2 text-xs text-slate-600">
                            <span className="material-symbols-outlined text-[16px] text-slate-400">cake</span>
                            DOB: {formatDate(summary.patient.dateOfBirth)}
                          </div>
                        )}
                      </dl>
                    </div>

                    {/* Doctor block */}
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">Clinic</p>
                      <p className="text-sm font-semibold text-slate-900">
                        Dr. {summary.doctor.firstName} {summary.doctor.lastName}
                      </p>
                      <p className="text-xs text-slate-600 mt-0.5">{summary.doctor.practiceName}</p>
                    </div>
                  </>
                ) : null}
              </>
            ) : (
              <div className="flex flex-col items-center justify-center text-center pt-12">
                <span className="material-symbols-outlined text-4xl text-slate-300 mb-2">badge</span>
                <p className="text-xs text-slate-500">Select a conversation to view patient details.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
