import 'dart:async';

import 'package:flutter/material.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_spacing.dart' as spacing;
import '../../../core/theme/app_text_styles.dart';
import '../../../core/widgets/app_header.dart';
import '../../../core/services/api_service.dart';
import '../models/conversation.dart';
import '../models/message.dart';

class ConversationThreadPage extends StatefulWidget {
  final String conversationId;

  const ConversationThreadPage({super.key, required this.conversationId});

  @override
  State<ConversationThreadPage> createState() => _ConversationThreadPageState();
}

class _ConversationThreadPageState extends State<ConversationThreadPage> {
  final ApiService _apiService = ApiService();
  final TextEditingController _messageController = TextEditingController();
  final ScrollController _scrollController = ScrollController();
  List<Message> _messages = [];
  bool _isLoading = true;
  bool _isSending = false;
  Timer? _pollingTimer;
  String? _currentUserId;
  String? _doctorName;
  String? _selectedMessageId;

  @override
  void initState() {
    super.initState();
    _loadConversationDetails();
    _loadCurrentUser().then((_) {
      _loadMessages(scrollToLatest: true);
      _markAsRead();
    });
    _startPolling();
  }

  Future<void> _loadConversationDetails() async {
    try {
      final response = await _apiService.getConversations();
      if (response['success'] == true && response['data'] != null) {
        final List<dynamic> data = response['data'];
        final conversations = data
            .map((json) => Conversation.fromJson(json))
            .toList();
        final conversation = conversations.firstWhere(
          (conv) => conv.id == widget.conversationId,
          orElse: () => conversations.first,
        );
        if (!mounted) return;
        setState(() {
          _doctorName = conversation.doctorName;
        });
      }
    } catch (e) {
      // Silently fail - we'll show a generic header
    }
  }

  Future<void> _loadCurrentUser() async {
    try {
      final response = await _apiService.getCurrentUser();
      if (response['success'] == true && response['data'] != null) {
        if (!mounted) return;
        setState(() {
          // Use user_id instead of id - messages use sender_user_id which is the users.id
          _currentUserId =
              response['data']['user_id'] as String? ??
              response['data']['id'] as String?;
        });
      }
    } catch (e) {
      // Silently fail - we'll handle message direction differently
    }
  }

  @override
  void dispose() {
    _pollingTimer?.cancel();
    _messageController.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  Future<void> _loadMessages({bool scrollToLatest = false}) async {
    try {
      final response = await _apiService.getMessages(widget.conversationId);
      if (response['success'] == true && response['data'] != null) {
        final List<dynamic> data = response['data'];
        final messages = data.map((json) => Message.fromJson(json)).toList();
        if (!mounted) return;
        setState(() {
          _messages = messages;
          _isLoading = false;
        });
        if (scrollToLatest) {
          _scrollToBottom();
        }
      } else {
        if (!mounted) return;
        setState(() {
          _messages = [];
          _isLoading = false;
        });
      }
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _messages = [];
        _isLoading = false;
      });
    }
  }

  Future<void> _markAsRead() async {
    try {
      await _apiService.markAsRead(widget.conversationId);
    } catch (e) {
      // Silently fail - don't block the UI
    }
  }

  void _startPolling() {
    _pollingTimer = Timer.periodic(const Duration(seconds: 12), (timer) {
      _loadMessages();
    });
  }

  void _scrollToBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted || !_scrollController.hasClients) return;
      final position = _scrollController.position;
      if (position.pixels >= position.maxScrollExtent) return;

      _scrollController.animateTo(
        position.maxScrollExtent,
        duration: const Duration(milliseconds: 300),
        curve: Curves.easeOut,
      );
    });
  }

  Future<void> _sendMessage() async {
    final message = _messageController.text.trim();
    if (message.isEmpty || _isSending) return;

    setState(() {
      _isSending = true;
    });

    try {
      final response = await _apiService.sendMessage(
        widget.conversationId,
        message,
      );

      if (response['success'] == true) {
        _messageController.clear();
        await _loadMessages(scrollToLatest: true);
      } else {
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              response['error']?['message'] ?? 'Failed to send message',
            ),
            backgroundColor: AppColors.error,
          ),
        );
      }
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Failed to send message'),
          backgroundColor: AppColors.error,
        ),
      );
    } finally {
      if (!mounted) return;
      setState(() {
        _isSending = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        backgroundColor: AppColors.surfaceLowest,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => Navigator.of(context).pop(),
        ),
        title: Text(
          _doctorName != null ? "Dr. $_doctorName's Secretary" : 'Conversation',
          style: AppTextStyles.bodyMdMedium,
          overflow: TextOverflow.ellipsis,
          maxLines: 1,
        ),
      ),
      body: Column(
        children: [
          Expanded(
            child: _isLoading
                ? const Center(child: CircularProgressIndicator())
                : _messages.isEmpty
                ? Center(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(
                          Icons.chat_bubble_outline,
                          size: 64,
                          color: AppColors.secondary,
                        ),
                        const SizedBox(height: spacing.AppSpacing.gutterMd),
                        Text(
                          'No messages yet',
                          style: AppTextStyles.bodyMd.copyWith(
                            color: AppColors.secondary,
                          ),
                        ),
                        const SizedBox(height: spacing.AppSpacing.gutterSm),
                        Text(
                          'Start the conversation',
                          style: AppTextStyles.labelSm.copyWith(
                            color: AppColors.outline,
                          ),
                        ),
                      ],
                    ),
                  )
                : ListView.builder(
                    controller: _scrollController,
                    padding: EdgeInsets.all(spacing.AppSpacing.screenPadding),
                    itemCount: _messages.length,
                    itemBuilder: (context, index) {
                      final message = _messages[index];
                      return _buildMessageBubble(message);
                    },
                  ),
          ),
          _buildMessageInput(),
        ],
      ),
    );
  }

  Widget _buildMessageBubble(Message message) {
    // Check if message is from current user (patient)
    final isFromPatient = message.senderUserId == _currentUserId;
    final isSelected = _selectedMessageId == message.id;

    // Clean the message content - remove email if present
    String cleanMessage = message.message;
    if (cleanMessage.contains('@') &&
        RegExp(r'\S+@\S+\.\S+').hasMatch(cleanMessage)) {
      // Remove email pattern from message
      cleanMessage = cleanMessage
          .replaceAll(RegExp(r'\S+@\S+\.\S+'), '')
          .trim();
      // Remove any remaining spaces/colons/commas around the email
      cleanMessage = cleanMessage.replaceAll(RegExp(r'^[\s,:]+|[\s,:]+$'), '');
    }

    return Padding(
      padding: EdgeInsets.only(bottom: spacing.AppSpacing.gutterMd),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.end,
        mainAxisAlignment: isFromPatient
            ? MainAxisAlignment.end
            : MainAxisAlignment.start,
        children: [
          if (!isFromPatient) ...[
            // Profile picture for secretary messages (left side)
            Container(
              width: 36,
              height: 36,
              decoration: BoxDecoration(
                color: AppColors.surfaceContainer,
                borderRadius: BorderRadius.circular(
                  spacing.AppSpacing.radiusFull,
                ),
              ),
              child: Icon(Icons.person, color: AppColors.outline, size: 20),
            ),
            const SizedBox(width: spacing.AppSpacing.gutterSm),
          ],
          Column(
            crossAxisAlignment: isFromPatient
                ? CrossAxisAlignment.end
                : CrossAxisAlignment.start,
            children: [
              GestureDetector(
                onTap: () {
                  setState(() {
                    _selectedMessageId = isSelected ? null : message.id;
                  });
                },
                child: Container(
                  constraints: BoxConstraints(
                    maxWidth: isFromPatient
                        ? MediaQuery.of(context).size.width * 0.85
                        : MediaQuery.of(context).size.width * 0.75,
                  ),
                  padding: EdgeInsets.symmetric(
                    horizontal: spacing.AppSpacing.gutterSm,
                    vertical: spacing.AppSpacing.gutterSm,
                  ),
                  decoration: BoxDecoration(
                    color: isFromPatient
                        ? AppColors.primary
                        : AppColors.surfaceContainer,
                    borderRadius: BorderRadius.circular(
                      spacing.AppSpacing.radiusLg,
                    ),
                  ),
                  child: Text(
                    cleanMessage,
                    style: AppTextStyles.bodyMd.copyWith(
                      color: isFromPatient
                          ? AppColors.onPrimary
                          : AppColors.onSurface,
                    ),
                    softWrap: true,
                    overflow: TextOverflow.visible,
                    textAlign: isFromPatient ? TextAlign.right : TextAlign.left,
                  ),
                ),
              ),
              // Show timestamp only when message is selected
              if (isSelected) ...[
                const SizedBox(height: spacing.AppSpacing.gutterXs),
                Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      _formatMessageTime(message.sentAt),
                      style: AppTextStyles.labelSm.copyWith(
                        color: AppColors.secondary,
                      ),
                    ),
                    if (isFromPatient && message.readAt != null) ...[
                      const SizedBox(width: spacing.AppSpacing.gutterXs),
                      Text(
                        'Seen',
                        style: AppTextStyles.labelSm.copyWith(
                          color: AppColors.secondary,
                        ),
                      ),
                    ],
                  ],
                ),
              ],
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildMessageInput() {
    return Container(
      padding: EdgeInsets.all(spacing.AppSpacing.screenPadding),
      decoration: BoxDecoration(
        color: AppColors.surfaceLowest,
        border: Border(
          top: BorderSide(color: AppColors.slate200.withValues(alpha: 0.5)),
        ),
      ),
      child: SafeArea(
        top: false,
        child: Row(
          children: [
            Expanded(
              child: Container(
                padding: EdgeInsets.symmetric(
                  horizontal: spacing.AppSpacing.gutterMd,
                ),
                decoration: BoxDecoration(
                  color: AppColors.surfaceLow,
                  borderRadius: BorderRadius.circular(
                    spacing.AppSpacing.radiusLg,
                  ),
                ),
                child: TextField(
                  controller: _messageController,
                  decoration: InputDecoration(
                    hintText: 'Type a message...',
                    hintStyle: AppTextStyles.bodyMd.copyWith(
                      color: AppColors.outline,
                    ),
                    border: InputBorder.none,
                  ),
                  style: AppTextStyles.bodyMd,
                  maxLines: null,
                  textInputAction: TextInputAction.send,
                  onSubmitted: (_) => _sendMessage(),
                ),
              ),
            ),
            const SizedBox(width: spacing.AppSpacing.gutterSm),
            Container(
              decoration: BoxDecoration(
                color: _isSending ? AppColors.outline : AppColors.primary,
                borderRadius: BorderRadius.circular(
                  spacing.AppSpacing.radiusLg,
                ),
              ),
              child: IconButton(
                icon: _isSending
                    ? SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          valueColor: AlwaysStoppedAnimation<Color>(
                            AppColors.onPrimary,
                          ),
                        ),
                      )
                    : const Icon(Icons.send, color: AppColors.onPrimary),
                onPressed: _isSending ? null : _sendMessage,
              ),
            ),
          ],
        ),
      ),
    );
  }

  String _formatMessageTime(DateTime dateTime) {
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final messageDate = DateTime(dateTime.year, dateTime.month, dateTime.day);

    // Check if message was sent on a previous day
    if (messageDate.isBefore(today)) {
      // Format as "Monday 11:38 PM"
      final weekday = [
        'Monday',
        'Tuesday',
        'Wednesday',
        'Thursday',
        'Friday',
        'Saturday',
        'Sunday',
      ][dateTime.weekday - 1];
      final hours = dateTime.hour;
      final minutes = dateTime.minute.toString().padLeft(2, '0');
      final ampm = hours >= 12 ? 'PM' : 'AM';
      final displayHours = hours % 12 == 0 ? 12 : hours % 12;
      return '$weekday $displayHours:$minutes $ampm';
    } else {
      // Same day - format as time only (e.g., "11:38 PM")
      final hours = dateTime.hour;
      final minutes = dateTime.minute.toString().padLeft(2, '0');
      final ampm = hours >= 12 ? 'PM' : 'AM';
      final displayHours = hours % 12 == 0 ? 12 : hours % 12;
      return '$displayHours:$minutes $ampm';
    }
  }
}
