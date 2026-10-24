import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_spacing.dart' as spacing;
import '../../../core/theme/app_text_styles.dart';
import '../../../core/widgets/app_card.dart';
import '../../../core/services/api_service.dart';
import '../../../core/constants/ai_constants.dart';

class AiConversationHistoryPage extends StatefulWidget {
  const AiConversationHistoryPage({super.key});

  @override
  State<AiConversationHistoryPage> createState() => _AiConversationHistoryPageState();
}

class _AiConversationHistoryPageState extends State<AiConversationHistoryPage> {
  final ApiService _apiService = ApiService();
  List<Map<String, dynamic>> _conversations = [];
  bool _isLoading = true;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _loadConversations();
  }

  Future<void> _loadConversations() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final response = await _apiService.getAiConversations();
      if (response['success'] == true && response['data'] != null) {
        setState(() {
          _conversations = List<Map<String, dynamic>>.from(response['data']);
          // Filter out conversations with zero messages
          _conversations = _conversations.where((conv) {
            final messageCount = int.tryParse(conv['message_count'].toString()) ?? 0;
            return messageCount > 0;
          }).toList();
          // Sort by updated_at descending (newest first)
          _conversations.sort((a, b) {
            final aDate = DateTime.parse(a['updated_at'].toString());
            final bDate = DateTime.parse(b['updated_at'].toString());
            return bDate.compareTo(aDate);
          });
          _isLoading = false;
        });
      } else {
        setState(() {
          _conversations = [];
          _isLoading = false;
        });
      }
    } catch (e) {
      print('Error loading AI conversations: $e');
      setState(() {
        _errorMessage = 'Failed to load conversations: $e';
        _isLoading = false;
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
          'Conversations',
          style: AppTextStyles.bodyMdMedium,
        ),
      ),
      body: Column(
        children: [
          Expanded(
            child: _buildContent(),
          ),
        ],
      ),
    );
  }

  Widget _buildContent() {
    if (_isLoading) {
      return const Center(child: CircularProgressIndicator());
    }

    if (_errorMessage != null) {
      return Center(
        child: Padding(
          padding: EdgeInsets.all(spacing.AppSpacing.screenPadding),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(Icons.error_outline, color: AppColors.secondary, size: 64),
              const SizedBox(height: spacing.AppSpacing.gutterMd),
              Text(
                _errorMessage!,
                style: AppTextStyles.bodyMd.copyWith(
                  color: AppColors.secondary,
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: spacing.AppSpacing.gutterLg),
              ElevatedButton(
                onPressed: _loadConversations,
                child: const Text('Retry'),
              ),
            ],
          ),
        ),
      );
    }

    if (_conversations.isEmpty) {
      return Center(
        child: Padding(
          padding: EdgeInsets.all(spacing.AppSpacing.screenPadding),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(Icons.chat_bubble_outline, color: AppColors.outline, size: 64),
              const SizedBox(height: spacing.AppSpacing.gutterMd),
              Text(
                'No conversations yet',
                style: AppTextStyles.bodyLgMedium,
              ),
              const SizedBox(height: spacing.AppSpacing.gutterSm),
              Text(
                'Your chats with ${AiConstants.name} will appear here.',
                style: AppTextStyles.bodyMd.copyWith(
                  color: AppColors.secondary,
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: spacing.AppSpacing.gutterLg),
              ElevatedButton.icon(
                icon: const Icon(Icons.add),
                label: const Text('Start a conversation'),
                onPressed: () => Navigator.of(context).pop(),
              ),
            ],
          ),
        ),
      );
    }

    return ListView.builder(
      padding: EdgeInsets.all(spacing.AppSpacing.screenPadding),
      itemCount: _conversations.length,
      itemBuilder: (context, index) {
        final conversation = _conversations[index];
        return AppCard(
          padding: EdgeInsets.all(spacing.AppSpacing.gutterMd),
          margin: EdgeInsets.only(bottom: spacing.AppSpacing.gutterMd),
          child: InkWell(
            onTap: () {
              Navigator.of(context).pop(conversation['id']);
            },
            child: Padding(
              padding: EdgeInsets.symmetric(vertical: spacing.AppSpacing.gutterSm),
              child: Row(
                children: [
                  const Icon(Icons.chat_bubble_outline, color: AppColors.primary),
                  const SizedBox(width: spacing.AppSpacing.gutterMd),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          conversation['title'] ?? _generateConversationTitle(conversation['last_message']),
                          style: AppTextStyles.bodyMd,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                        ),
                        const SizedBox(height: spacing.AppSpacing.gutterXs),
                        Text(
                          _formatDate(conversation['updated_at']),
                          style: AppTextStyles.labelSm.copyWith(
                            color: AppColors.secondary,
                          ),
                        ),
                      ],
                    ),
                  ),
                  IconButton(
                    icon: const Icon(Icons.more_vert, color: AppColors.secondary),
                    onPressed: () {
                      _showActionSheet(conversation);
                    },
                  ),
                ],
              ),
            ),
          ),
        );
      },
    );
  }

  Future<void> _showActionSheet(Map<String, dynamic> conversation) async {
    await showModalBottomSheet(
      context: context,
      builder: (context) => Container(
        padding: EdgeInsets.all(spacing.AppSpacing.gutterMd),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              leading: const Icon(Icons.edit, color: AppColors.primary),
              title: const Text('Rename'),
              onTap: () {
                Navigator.of(context).pop();
                _showRenameDialog(conversation['id'], conversation['title'] ?? _generateConversationTitle(conversation['last_message']));
              },
            ),
            ListTile(
              leading: const Icon(Icons.delete_outline, color: AppColors.error),
              title: const Text('Delete', style: TextStyle(color: AppColors.error)),
              onTap: () {
                Navigator.of(context).pop();
                _showDeleteConfirmation(conversation['id']);
              },
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _showRenameDialog(String conversationId, String currentTitle) async {
    final controller = TextEditingController(text: currentTitle);
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Rename conversation'),
        content: TextField(
          controller: controller,
          decoration: const InputDecoration(
            hintText: 'Enter new title',
          ),
          autofocus: true,
          onSubmitted: (value) {
            if (value.trim().isNotEmpty) {
              Navigator.of(context).pop(true);
            }
          },
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () => Navigator.of(context).pop(true),
            child: const Text('Save'),
          ),
        ],
      ),
    );

    if (confirmed == true && controller.text.trim().isNotEmpty) {
      await _renameConversation(conversationId, controller.text.trim());
    }
  }

  Future<void> _renameConversation(String conversationId, String newTitle) async {
    try {
      final response = await _apiService.renameAiConversation(conversationId, newTitle);
      if (response['success'] == true) {
        setState(() {
          final index = _conversations.indexWhere((conv) => conv['id'] == conversationId);
          if (index != -1) {
            _conversations[index]['title'] = newTitle;
          }
        });
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Conversation renamed'),
              backgroundColor: AppColors.brandTeal,
            ),
          );
        }
      } else {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(response['error']?['message'] ?? 'Failed to rename conversation'),
              backgroundColor: AppColors.error,
            ),
          );
        }
      }
    } catch (e) {
      print('Error renaming conversation: $e');
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to rename conversation: $e'),
            backgroundColor: AppColors.error,
          ),
        );
      }
    }
  }

  Future<void> _showDeleteConfirmation(String conversationId) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Delete conversation'),
        content: const Text('Are you sure you want to delete this conversation? This action cannot be undone.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () => Navigator.of(context).pop(true),
            style: TextButton.styleFrom(foregroundColor: AppColors.error),
            child: const Text('Delete'),
          ),
        ],
      ),
    );

    if (confirmed == true) {
      await _deleteConversation(conversationId);
    }
  }

  Future<void> _deleteConversation(String conversationId) async {
    try {
      final response = await _apiService.deleteAiConversation(conversationId);
      if (response['success'] == true) {
        setState(() {
          _conversations.removeWhere((conv) => conv['id'] == conversationId);
        });
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Conversation deleted'),
              backgroundColor: AppColors.brandTeal,
            ),
          );
        }
      } else {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(response['error']?['message'] ?? 'Failed to delete conversation'),
              backgroundColor: AppColors.error,
            ),
          );
        }
      }
    } catch (e) {
      print('Error deleting conversation: $e');
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to delete conversation: $e'),
            backgroundColor: AppColors.error,
          ),
        );
      }
    }
  }

  String _formatDate(dynamic dateValue) {
    if (dateValue == null) return '';
    final date = DateTime.parse(dateValue.toString());
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final messageDate = DateTime(date.year, date.month, date.day);

    if (messageDate.isAtSameMomentAs(today)) {
      return 'Today';
    } else if (messageDate.isAtSameMomentAs(today.subtract(const Duration(days: 1)))) {
      return 'Yesterday';
    } else {
      return '${date.month}/${date.day}/${date.year}';
    }
  }

  String _generateConversationTitle(String? lastMessage) {
    if (lastMessage == null || lastMessage.isEmpty) {
      return 'New Conversation';
    }

    final message = lastMessage.toLowerCase();

    // Detect common topics and generate meaningful titles
    if (message.contains('blood test') || message.contains('lab result')) {
      return 'Blood Test Information';
    } else if (message.contains('diabetes') || message.contains('sugar')) {
      return 'Diabetes Question';
    } else if (message.contains('headache') || message.contains('migraine')) {
      return 'Headache Concern';
    } else if (message.contains('fever') || message.contains('temperature')) {
      return 'Fever Question';
    } else if (message.contains('doctor') && message.contains('available')) {
      return 'Doctor Availability';
    } else if (message.contains('appointment') || message.contains('booking')) {
      return 'Appointment Inquiry';
    } else if (message.contains('symptom') || message.contains('pain')) {
      return 'Symptom Inquiry';
    } else if (message.contains('medicine') || message.contains('medication') || message.contains('drug')) {
      return 'Medication Question';
    } else if (message.contains('visit') || message.contains('checkup')) {
      return 'Visit Preparation';
    } else if (message.contains('what should i ask') || message.contains('questions to ask')) {
      return 'Doctor Visit Questions';
    } else if (message.contains('chest pain') || message.contains('breathing')) {
      return 'Urgent Care Question';
    } else if (message.contains('allergy') || message.contains('allergic')) {
      return 'Allergy Question';
    } else if (message.contains('diet') || message.contains('nutrition') || message.contains('food')) {
      return 'Nutrition Question';
    } else if (message.contains('exercise') || message.contains('fitness') || message.contains('workout')) {
      return 'Fitness Question';
    } else if (message.contains('sleep') || message.contains('insomnia')) {
      return 'Sleep Question';
    } else if (message.contains('stress') || message.contains('anxiety') || message.contains('mental health')) {
      return 'Mental Health Question';
    } else if (message.contains('vaccine') || message.contains('immunization') || message.contains('shot')) {
      return 'Vaccination Question';
    } else if (message.contains('pregnancy') || message.contains('pregnant')) {
      return 'Pregnancy Question';
    } else if (message.contains('child') || message.contains('baby') || message.contains('kid')) {
      return 'Child Health Question';
    } else if (message.contains('heart') || message.contains('cardiac')) {
      return 'Heart Health Question';
    } else if (message.contains('blood pressure') || message.contains('bp')) {
      return 'Blood Pressure Question';
    } else if (message.contains('cancer') || message.contains('tumor')) {
      return 'Cancer Question';
    } else {
      // Default: use first 30 characters of the message
      return lastMessage.length > 30
          ? '${lastMessage.substring(0, 30)}...'
          : lastMessage;
    }
  }
}
