import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_markdown/flutter_markdown.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_spacing.dart' as spacing;
import '../../../core/theme/app_text_styles.dart';
import '../../../core/widgets/app_card.dart';
import '../../../core/services/api_service.dart';
import '../../../core/constants/ai_constants.dart';

class AiConversationPage extends StatefulWidget {
  const AiConversationPage({super.key});

  @override
  State<AiConversationPage> createState() => _AiConversationPageState();
}

class _AiConversationPageState extends State<AiConversationPage> {
  final ApiService _apiService = ApiService();
  final TextEditingController _messageController = TextEditingController();
  final ScrollController _scrollController = ScrollController();
  
  List<Map<String, dynamic>> _messages = [];
  String? _currentConversationId;
  bool _isSending = false;
  bool _hasShownFirstUseNotice = false;
  String? _limitReachedMessage;
  bool _isAiUnavailable = false;

  @override
  void initState() {
    super.initState();
    _loadFirstUseNotice();
  }

  Future<void> _loadFirstUseNotice() async {
    final prefs = await SharedPreferences.getInstance();
    setState(() {
      _hasShownFirstUseNotice = prefs.getBool('ai_first_use_notice_shown') ?? false;
    });
  }

  Future<void> _loadConversation(String conversationId) async {
    try {
      final response = await _apiService.getAiConversationMessages(conversationId);
      if (response['success'] == true && response['data'] != null) {
        setState(() {
          _messages = List<Map<String, dynamic>>.from(response['data']);
          _currentConversationId = conversationId;
        });
      }
    } catch (e) {
      // Handle error
    }
  }

  Future<void> _sendMessage() async {
    final message = _messageController.text.trim();
    if (message.isEmpty || _isSending) return;

    setState(() {
      _isSending = true;
    });

    try {
      final response = await _apiService.sendAiMessage(
        message,
        conversationId: _currentConversationId,
      );

      if (response['success'] == true) {
        _messageController.clear();
        setState(() {
          _currentConversationId = response['data']['conversationId'];
          _limitReachedMessage = null;
        });
        
        // Always load conversation to get user's message
        await _loadConversation(_currentConversationId!);
        
        // Check if response contains doctor lookup results and add doctor cards (without showing the JSON message)
        if (response['data']['type'] == 'doctor_lookup' && response['data']['doctors'] != null) {
          setState(() {
            _messages.add({
              'role': 'ASSISTANT',
              'content': '', // Empty content - only show doctor cards
              'isDoctorLookup': true,
              'doctors': response['data']['doctors'],
            });
          });
        }
      } else {
        final errorCode = response['error']?['code'];
        if (errorCode == 'RATE_LIMIT') {
          setState(() {
            _limitReachedMessage = response['error']?['message'] ?? 'Daily limit reached';
          });
        } else if (errorCode == 'AI_SERVICE_UNAVAILABLE') {
          setState(() {
            _isAiUnavailable = true;
          });
        }
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(
                response['error']?['message'] ?? 'Failed to send message',
              ),
              backgroundColor: AppColors.error,
            ),
          );
        }
      }
    } catch (e) {
      print('Error sending AI message: $e');
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to send message: $e'),
            backgroundColor: AppColors.error,
          ),
        );
      }
    } finally {
      setState(() {
        _isSending = false;
      });
    }
  }

  Future<void> _dismissFirstUseNotice() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool('ai_first_use_notice_shown', true);
    setState(() {
      _hasShownFirstUseNotice = true;
    });
  }

  @override
  void dispose() {
    _messageController.dispose();
    _scrollController.dispose();
    super.dispose();
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
          AiConstants.name,
          style: AppTextStyles.bodyMdMedium,
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.history),
            onPressed: () async {
              final result = await Navigator.of(context).pushNamed('/ai-conversation-history');
              if (result != null && result is String) {
                _loadConversation(result);
              }
            },
            tooltip: 'Conversation history',
          ),
          if (_isAiUnavailable)
            Container(
              width: 8,
              height: 8,
              decoration: BoxDecoration(
                color: AppColors.error,
                shape: BoxShape.circle,
              ),
            ),
        ],
      ),
      body: Column(
        children: [
          // M3: Persistent safety banner
          Container(
            width: double.infinity,
            padding: EdgeInsets.all(spacing.AppSpacing.gutterMd),
            decoration: BoxDecoration(
              color: AppColors.primary.withValues(alpha: 0.1),
              border: Border(
                bottom: BorderSide(color: AppColors.primary.withValues(alpha: 0.3)),
              ),
            ),
            child: Row(
              children: [
                Icon(Icons.info_outline, color: AppColors.primary, size: 20),
                const SizedBox(width: spacing.AppSpacing.gutterSm),
                Expanded(
                  child: Text(
                    'General health information only. Not a diagnosis or medical care.',
                    style: AppTextStyles.labelSm.copyWith(
                      color: AppColors.primary,
                    ),
                  ),
                ),
              ],
            ),
          ),
          // M3: First-use notice
          if (!_hasShownFirstUseNotice)
            Container(
              width: double.infinity,
              padding: EdgeInsets.all(spacing.AppSpacing.gutterMd),
              decoration: BoxDecoration(
                color: AppColors.urgentAmber.withValues(alpha: 0.1),
                border: Border(
                  bottom: BorderSide(color: AppColors.urgentAmber.withValues(alpha: 0.3)),
                ),
              ),
              child: Row(
                children: [
                  Icon(Icons.warning_amber_outlined, color: AppColors.urgentAmber, size: 20),
                  const SizedBox(width: spacing.AppSpacing.gutterSm),
                  Expanded(
                    child: Text(
                      '${AiConstants.fullName} is an AI assistant, not a doctor. Personal identifiers are not sent to the AI provider.',
                      style: AppTextStyles.labelSm.copyWith(
                        color: AppColors.urgentAmber,
                      ),
                    ),
                  ),
                  IconButton(
                    icon: const Icon(Icons.close, size: 16),
                    onPressed: _dismissFirstUseNotice,
                    padding: EdgeInsets.zero,
                    constraints: const BoxConstraints(),
                  ),
                ],
              ),
            ),
          // M7: Limit reached message
          if (_limitReachedMessage != null)
            Container(
              width: double.infinity,
              padding: EdgeInsets.all(spacing.AppSpacing.gutterMd),
              decoration: BoxDecoration(
                color: AppColors.error.withValues(alpha: 0.1),
                border: Border(
                  bottom: BorderSide(color: AppColors.error.withValues(alpha: 0.3)),
                ),
              ),
              child: Row(
                children: [
                  Icon(Icons.block, color: AppColors.error, size: 20),
                  const SizedBox(width: spacing.AppSpacing.gutterSm),
                  Expanded(
                    child: Text(
                      _limitReachedMessage!,
                      style: AppTextStyles.labelSm.copyWith(
                        color: AppColors.error,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          // M7: AI unavailable message
          if (_isAiUnavailable)
            Container(
              width: double.infinity,
              padding: EdgeInsets.all(spacing.AppSpacing.gutterMd),
              decoration: BoxDecoration(
                color: AppColors.secondary.withValues(alpha: 0.1),
                border: Border(
                  bottom: BorderSide(color: AppColors.secondary.withValues(alpha: 0.3)),
                ),
              ),
              child: Row(
                children: [
                  Icon(Icons.cloud_off, color: AppColors.secondary, size: 20),
                  const SizedBox(width: spacing.AppSpacing.gutterSm),
                  Expanded(
                    child: Text(
                      'AI assistant unavailable. Please try again later.',
                      style: AppTextStyles.labelSm.copyWith(
                        color: AppColors.secondary,
                      ),
                    ),
                  ),
                ],
              ),
            ),

          // Empty state (shown when no messages in current conversation)
          if (_messages.isEmpty)
            Expanded(
              child: SingleChildScrollView(
                padding: EdgeInsets.all(spacing.AppSpacing.screenPadding),
                child: Column(
                  children: [
                    // Limit reached message
                    if (_limitReachedMessage != null) ...[
                      Icon(Icons.block, color: AppColors.error, size: 64),
                      const SizedBox(height: spacing.AppSpacing.gutterMd),
                      Text(
                        _limitReachedMessage!,
                        style: AppTextStyles.bodyLgMedium.copyWith(
                          color: AppColors.error,
                        ),
                        textAlign: TextAlign.center,
                      ),
                      const SizedBox(height: spacing.AppSpacing.gutterSm),
                      Text(
                        'Try again tomorrow.',
                        style: AppTextStyles.bodyMd.copyWith(
                          color: AppColors.secondary,
                        ),
                        textAlign: TextAlign.center,
                      ),
                      const SizedBox(height: spacing.AppSpacing.gutterLg),
                    ],
                    // Welcome block (disappears after first message)
                    if (!_isAiUnavailable && _limitReachedMessage == null) ...[
                      Container(
                        padding: EdgeInsets.all(spacing.AppSpacing.gutterLg),
                        decoration: BoxDecoration(
                          color: AppColors.primary.withValues(alpha: 0.05),
                          borderRadius: BorderRadius.circular(spacing.AppSpacing.radiusLg),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                Image.asset(
                                  'assets/images/mediguide_badge.png',
                                  width: 40,
                                  height: 40,
                                ),
                                const SizedBox(width: spacing.AppSpacing.gutterMd),
                                Text(
                                  "Hi, I'm ${AiConstants.name}",
                                  style: AppTextStyles.bodyLgMedium,
                                ),
                              ],
                            ),
                            const SizedBox(height: spacing.AppSpacing.gutterMd),
                            Text(
                              'I can help you understand health topics, know when to see a doctor, prepare questions for your visit, find doctors, and navigate the app.',
                              style: AppTextStyles.bodyMd.copyWith(
                                color: AppColors.secondary,
                              ),
                            ),
                            const SizedBox(height: spacing.AppSpacing.gutterMd),
                            Container(
                              padding: EdgeInsets.all(spacing.AppSpacing.gutterMd),
                              decoration: BoxDecoration(
                                color: AppColors.urgentAmber.withValues(alpha: 0.1),
                                borderRadius: BorderRadius.circular(spacing.AppSpacing.radiusLg),
                              ),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Row(
                                    children: [
                                      Icon(Icons.warning_amber_outlined, color: AppColors.urgentAmber, size: 20),
                                      const SizedBox(width: spacing.AppSpacing.gutterSm),
                                      Expanded(
                                        child: Text(
                                          'Important',
                                          style: AppTextStyles.labelSm.copyWith(
                                            color: AppColors.urgentAmber,
                                            fontWeight: FontWeight.w600,
                                          ),
                                        ),
                                      ),
                                    ],
                                  ),
                                  const SizedBox(height: spacing.AppSpacing.gutterSm),
                                  Text(
                                    'I cannot diagnose, prescribe, or replace a doctor. In an emergency, contact your local emergency number immediately.',
                                    style: AppTextStyles.bodySm.copyWith(
                                      color: AppColors.secondary,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: spacing.AppSpacing.gutterLg),
                      // Starter chips (hidden when limit reached)
                      if (_limitReachedMessage == null) _buildStarterChips(),
                    ],
                    // Unavailable state (shown when AI is unavailable)
                    if (_isAiUnavailable) ...[
                      Icon(Icons.cloud_off, color: AppColors.secondary, size: 64),
                      const SizedBox(height: spacing.AppSpacing.gutterMd),
                      Text(
                        '${AiConstants.name} is currently unavailable.',
                        style: AppTextStyles.bodyLgMedium,
                        textAlign: TextAlign.center,
                      ),
                      const SizedBox(height: spacing.AppSpacing.gutterSm),
                      Text(
                        'For concerns, you can book an appointment or contact the clinic.',
                        style: AppTextStyles.bodyMd.copyWith(
                          color: AppColors.secondary,
                        ),
                        textAlign: TextAlign.center,
                      ),
                      const SizedBox(height: spacing.AppSpacing.gutterLg),
                      Row(
                        children: [
                          Expanded(
                            child: OutlinedButton.icon(
                              icon: const Icon(Icons.search, size: 18),
                              label: const Text('Find a doctor'),
                              onPressed: () {
                                Navigator.of(context).pop();
                              },
                            ),
                          ),
                          const SizedBox(width: spacing.AppSpacing.gutterSm),
                          Expanded(
                            child: ElevatedButton.icon(
                              icon: const Icon(Icons.calendar_today, size: 18),
                              label: const Text('Book appointment'),
                              onPressed: () {
                                Navigator.of(context).pop();
                              },
                            ),
                          ),
                        ],
                      ),
                    ],
                  ],
                ),
              ),
            ),
          // Active conversation messages
          if (_currentConversationId != null && _messages.isNotEmpty)
            Expanded(
              child: ListView.builder(
                controller: _scrollController,
                padding: EdgeInsets.all(spacing.AppSpacing.screenPadding),
                itemCount: _messages.length,
                itemBuilder: (context, index) {
                  final message = _messages[index];
                  return _buildAiMessageBubble(message);
                },
              ),
            ),
          _buildMessageInput(),
        ],
      ),
    );
  }

  Widget _buildAiMessageBubble(Map<String, dynamic> message) {
    final isFromUser = message['role'] == 'USER';
    final content = message['content'] as String;

    // M5: Check if response contains doctor lookup results
    if (!isFromUser && message['isDoctorLookup'] == true && message['doctors'] != null) {
      return _buildDoctorCards(message['doctors'] as List<dynamic>);
    }

    // M6: Check if response is a diagnosis refusal or urgent-care message
    if (!isFromUser && _isDiagnosisRefusal(content)) {
      return _buildDiagnosisRefusalCard(content);
    }

    // M6: Check if response is an urgent-care message
    if (!isFromUser && _isUrgentCareMessage(content)) {
      return _buildUrgentCareCard(content);
    }

    return Padding(
      padding: EdgeInsets.only(bottom: spacing.AppSpacing.gutterMd),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.end,
        mainAxisAlignment: isFromUser
            ? MainAxisAlignment.end
            : MainAxisAlignment.start,
        children: [
          if (!isFromUser) ...[
            // M8: MediGuide badge icon for AI messages
            Container(
              width: 36,
              height: 36,
              decoration: BoxDecoration(
                color: AppColors.primary.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(
                  spacing.AppSpacing.radiusFull,
                ),
              ),
              child: ClipOval(
                child: Image.asset(
                  'assets/images/mediguide_badge.png',
                  width: 36,
                  height: 36,
                  fit: BoxFit.cover,
                ),
              ),
            ),
            const SizedBox(width: spacing.AppSpacing.gutterSm),
          ],
          Column(
            crossAxisAlignment: isFromUser
                ? CrossAxisAlignment.end
                : CrossAxisAlignment.start,
            children: [
              Container(
                constraints: BoxConstraints(
                  maxWidth: MediaQuery.of(context).size.width * 0.8,
                ),
                padding: EdgeInsets.symmetric(
                  horizontal: spacing.AppSpacing.gutterSm,
                  vertical: spacing.AppSpacing.gutterSm,
                ),
                decoration: BoxDecoration(
                  color: isFromUser
                      ? AppColors.primary
                      : AppColors.surfaceContainer,
                  borderRadius: BorderRadius.circular(
                    spacing.AppSpacing.radiusLg,
                  ),
                  // M8: Different bubble style for AI
                  border: !isFromUser
                      ? Border.all(color: AppColors.primary.withValues(alpha: 0.3))
                      : null,
                ),
                child: isFromUser
                    ? Text(
                        content,
                        style: AppTextStyles.bodyMd.copyWith(
                          color: AppColors.onPrimary,
                        ),
                        softWrap: true,
                        overflow: TextOverflow.visible,
                      )
                    : MarkdownBody(
                        data: content,
                        styleSheet: MarkdownStyleSheet(
                          p: AppTextStyles.bodyMd.copyWith(
                            color: AppColors.onSurface,
                          ),
                          h1: AppTextStyles.bodyLgMedium.copyWith(
                            color: AppColors.onSurface,
                          ),
                          h2: AppTextStyles.bodyMdMedium.copyWith(
                            color: AppColors.onSurface,
                          ),
                          h3: AppTextStyles.bodyMdMedium.copyWith(
                            color: AppColors.onSurface,
                          ),
                          listBullet: AppTextStyles.bodyMd.copyWith(
                            color: AppColors.onSurface,
                          ),
                          code: AppTextStyles.bodySm.copyWith(
                            color: AppColors.onSurface,
                            fontFamily: 'monospace',
                          ),
                          codeblockDecoration: BoxDecoration(
                            color: AppColors.surfaceContainer,
                            borderRadius: BorderRadius.circular(4),
                          ),
                        ),
                      ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  // M5: Build doctor cards from lookup results
  Widget _buildDoctorCards(List<dynamic> doctors) {
    return Padding(
      padding: EdgeInsets.only(bottom: spacing.AppSpacing.gutterMd),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // MediGuide badge icon
          Container(
            width: 20,
            height: 20,
            child: ClipOval(
              child: Image.asset(
                'assets/images/mediguide_badge.png',
                width: 20,
                height: 20,
                fit: BoxFit.cover,
              ),
            ),
          ),
          const SizedBox(height: spacing.AppSpacing.gutterSm),
          Text(
            'Available doctors',
            style: AppTextStyles.bodyMdMedium,
          ),
          const SizedBox(height: spacing.AppSpacing.gutterMd),
          ...doctors.map((doctor) => _buildDoctorCard(doctor as Map<String, dynamic>)),
        ],
      ),
    );
  }

  Widget _buildDoctorCard(Map<String, dynamic> doctor) {
    return AppCard(
      padding: EdgeInsets.all(spacing.AppSpacing.gutterMd),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 48,
                height: 48,
                decoration: BoxDecoration(
                  color: AppColors.surfaceContainer,
                  borderRadius: BorderRadius.circular(spacing.AppSpacing.radiusLg),
                ),
                child: Icon(Icons.person, color: AppColors.outline),
              ),
              const SizedBox(width: spacing.AppSpacing.gutterMd),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      doctor['name'] ?? 'Unknown',
                      style: AppTextStyles.bodyMdMedium,
                    ),
                    Text(
                      doctor['specialty'] ?? '',
                      style: AppTextStyles.labelSm.copyWith(
                        color: AppColors.secondary,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: spacing.AppSpacing.gutterMd),
          // M5: "Book visit" button
          ElevatedButton.icon(
            icon: const Icon(Icons.calendar_today, size: 18),
            label: const Text('Book visit'),
            onPressed: () {
              // Navigate to doctor schedule page with doctor ID
              Navigator.of(context).pushNamed(
                '/doctor-schedule',
                arguments: {'doctorId': doctor['id']},
              );
            },
            style: ElevatedButton.styleFrom(
              minimumSize: const Size(double.infinity, 36),
            ),
          ),
        ],
      ),
    );
  }

  // M6: Build diagnosis refusal card
  Widget _buildDiagnosisRefusalCard(String content) {
    return Padding(
      padding: EdgeInsets.only(bottom: spacing.AppSpacing.gutterMd),
      child: Container(
        decoration: BoxDecoration(
          border: Border.all(color: AppColors.urgentAmber.withValues(alpha: 0.5)),
          borderRadius: BorderRadius.circular(spacing.AppSpacing.radiusLg),
        ),
        child: AppCard(
          padding: EdgeInsets.all(spacing.AppSpacing.gutterMd),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  // MediGuide badge icon
                  Container(
                    width: 20,
                    height: 20,
                    child: ClipOval(
                      child: Image.asset(
                        'assets/images/mediguide_badge.png',
                        width: 20,
                        height: 20,
                        fit: BoxFit.cover,
                      ),
                    ),
                  ),
                  const SizedBox(width: spacing.AppSpacing.gutterSm),
                  Text(
                    'I cannot diagnose',
                    style: AppTextStyles.bodyMdMedium.copyWith(
                      color: AppColors.urgentAmber,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: spacing.AppSpacing.gutterSm),
              Text(
                content,
                style: AppTextStyles.bodyMd,
              ),
              const SizedBox(height: spacing.AppSpacing.gutterMd),
              // M6: "Find a doctor" and "Book appointment" actions
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton.icon(
                      icon: const Icon(Icons.search, size: 18),
                      label: const Text('Find a doctor'),
                      onPressed: () {
                        // Navigate to doctors tab
                      },
                    ),
                  ),
                  const SizedBox(width: spacing.AppSpacing.gutterSm),
                  Expanded(
                    child: ElevatedButton.icon(
                      icon: const Icon(Icons.calendar_today, size: 18),
                      label: const Text('Book appointment'),
                      onPressed: () {
                        // Navigate to appointments tab
                      },
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  // M6: Build urgent-care card
  Widget _buildUrgentCareCard(String content) {
    return Padding(
      padding: EdgeInsets.only(bottom: spacing.AppSpacing.gutterMd),
      child: Container(
        decoration: BoxDecoration(
          color: AppColors.emergencyCrimson.withValues(alpha: 0.1),
          border: Border.all(color: AppColors.emergencyCrimson.withValues(alpha: 0.5)),
          borderRadius: BorderRadius.circular(spacing.AppSpacing.radiusLg),
        ),
        child: AppCard(
          padding: EdgeInsets.all(spacing.AppSpacing.gutterMd),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  // MediGuide badge icon
                  Container(
                    width: 20,
                    height: 20,
                    child: ClipOval(
                      child: Image.asset(
                        'assets/images/mediguide_badge.png',
                        width: 20,
                        height: 20,
                        fit: BoxFit.cover,
                      ),
                    ),
                  ),
                  const SizedBox(width: spacing.AppSpacing.gutterSm),
                  Text(
                    'Urgent care needed',
                    style: AppTextStyles.bodyMdMedium.copyWith(
                      color: AppColors.emergencyCrimson,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: spacing.AppSpacing.gutterSm),
              Text(
                content,
                style: AppTextStyles.bodyMd,
              ),
              const SizedBox(height: spacing.AppSpacing.gutterMd),
              // M6: "Find a doctor" and "Book appointment" actions
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton.icon(
                      icon: const Icon(Icons.search, size: 18),
                      label: const Text('Find a doctor'),
                      onPressed: () {
                        // Navigate to doctors tab
                      },
                    ),
                  ),
                  const SizedBox(width: spacing.AppSpacing.gutterSm),
                  Expanded(
                    child: ElevatedButton.icon(
                      icon: const Icon(Icons.calendar_today, size: 18),
                      label: const Text('Book appointment'),
                      onPressed: () {
                        // Navigate to appointments tab
                      },
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  bool _isDiagnosisRefusal(String content) {
    final refusalKeywords = ['cannot diagnose', 'not a doctor', 'diagnosis', 'medical advice'];
    return refusalKeywords.any((keyword) => content.toLowerCase().contains(keyword));
  }

  bool _isUrgentCareMessage(String content) {
    final urgentKeywords = ['urgent', 'emergency', 'immediate', 'serious'];
    return urgentKeywords.any((keyword) => content.toLowerCase().contains(keyword));
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
                  enabled: _limitReachedMessage == null,
                  decoration: InputDecoration(
                    hintText: _limitReachedMessage != null
                        ? 'Daily limit reached. Try again tomorrow.'
                        : 'Ask ${AiConstants.name} a question…',
                    hintStyle: AppTextStyles.bodyMd.copyWith(
                      color: _limitReachedMessage != null
                          ? AppColors.error
                          : AppColors.outline,
                    ),
                    border: InputBorder.none,
                  ),
                  style: AppTextStyles.bodyMd,
                  maxLines: null,
                  maxLength: 2000, // F4: Message length cap
                  textInputAction: TextInputAction.send,
                  onSubmitted: _limitReachedMessage == null ? (_) => _sendMessage() : null,
                ),
              ),
            ),
            const SizedBox(width: spacing.AppSpacing.gutterSm),
            Container(
              decoration: BoxDecoration(
                color: _isSending || _limitReachedMessage != null
                    ? AppColors.outline
                    : AppColors.primary,
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
                onPressed: _isSending || _limitReachedMessage != null ? null : _sendMessage,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildStarterChips() {
    final chips = [
      'What should I ask my doctor?',
      'Doctors available today',
      'What does a blood test show?',
    ];

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Optional starter chips:',
          style: AppTextStyles.labelSm.copyWith(
            color: AppColors.secondary,
          ),
        ),
        const SizedBox(height: spacing.AppSpacing.gutterSm),
        Wrap(
          spacing: spacing.AppSpacing.gutterSm,
          runSpacing: spacing.AppSpacing.gutterSm,
          children: chips.map((chip) => ActionChip(
            label: Text(chip),
            onPressed: () {
              _messageController.text = chip;
            },
            backgroundColor: AppColors.primary.withValues(alpha: 0.1),
            labelStyle: AppTextStyles.bodySm.copyWith(
              color: AppColors.primary,
            ),
          )).toList(),
        ),
      ],
    );
  }
}
