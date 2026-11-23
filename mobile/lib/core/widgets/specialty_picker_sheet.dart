import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../theme/app_colors.dart';
import '../theme/app_text_styles.dart';

Future<void> showSpecialtyPickerSheet(
  BuildContext context, {
  required List<String> specialties,
  required Map<String, int> counts,
  required int totalDoctors,
  required String selected,
  required bool allSelected,
  required ValueChanged<String> onSelected,
  required VoidCallback onSelectAll,
  required IconData Function(String) iconFor,
  required Color Function(String) bgFor,
  required Color Function(String) iconColorFor,
}) {
  final bool isAllSelected = allSelected || selected.isEmpty;
  final bool showSearch = specialties.length > 6;

  return showModalBottomSheet(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    backgroundColor: AppColors.surface,
    showDragHandle: false,
    builder: (context) => Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            margin: const EdgeInsets.only(top: 12, bottom: 8),
            height: 4,
            width: 40,
            decoration: BoxDecoration(
              color: AppColors.outline.withValues(alpha: 0.4),
              borderRadius: BorderRadius.circular(2),
            ),
          ),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(
                            'Choose specialty',
                            style: AppTextStyles.headlineSm.copyWith(
                              fontWeight: FontWeight.bold,
                              fontSize: 20,
                              color: AppColors.onSurface,
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            '${specialties.length} specialt${specialties.length == 1 ? 'y' : 'ies'} Â· $totalDoctors doctor${totalDoctors == 1 ? '' : 's'}',
                            style: AppTextStyles.bodyMd.copyWith(
                              color: AppColors.onSurfaceVariant,
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ],
                      ),
                    ),
                    IconButton(
                      icon: const Icon(Icons.close),
                      color: AppColors.onSurfaceVariant,
                      onPressed: () => Navigator.of(context).pop(),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
              ],
            ),
          ),
          if (showSearch) ...[
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20),
              child: _SpecialtySearchField(),
            ),
            const SizedBox(height: 8),
          ],
          if (specialties.isEmpty)
            _buildEmptyState()
          else
            _SpecialtyList(
              context: context,
              specialties: specialties,
              counts: counts,
              totalDoctors: totalDoctors,
              selected: selected,
              isAllSelected: isAllSelected,
              iconFor: iconFor,
              bgFor: bgFor,
              iconColorFor: iconColorFor,
              onSelected: onSelected,
              onSelectAll: onSelectAll,
            ),
        ],
      ),
    ),
  );
}

class _SpecialtySearchField extends StatefulWidget {
  const _SpecialtySearchField();

  @override
  State<_SpecialtySearchField> createState() => _SpecialtySearchFieldState();
}

class _SpecialtySearchFieldState extends State<_SpecialtySearchField> {
  final TextEditingController _controller = TextEditingController();

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final bool hasText = _controller.text.isNotEmpty;
    return TextField(
      controller: _controller,
      decoration: InputDecoration(
        hintText: 'Search specialties',
        hintStyle: AppTextStyles.bodyMd.copyWith(
          color: AppColors.onSurfaceVariant,
        ),
        prefixIcon: Icon(
          Icons.search,
          color: AppColors.onSurfaceVariant,
        ),
        suffixIcon: hasText
            ? IconButton(
                icon: const Icon(Icons.close),
                color: AppColors.onSurfaceVariant,
                onPressed: () {
                  _controller.clear();
                  setState(() {});
                },
              )
            : null,
        filled: true,
        fillColor: AppColors.surfaceContainerHigh,
        enabledBorder: InputBorder.none,
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(24),
          borderSide: BorderSide(color: AppColors.primary, width: 1.5),
        ),
        border: InputBorder.none,
        contentPadding: const EdgeInsets.symmetric(
          horizontal: 20,
          vertical: 14,
        ),
      ),
      style: AppTextStyles.bodyMd.copyWith(
        color: AppColors.onSurface,
      ),
    );
  }
}

class _SpecialtyList extends StatelessWidget {
  final BuildContext context;
  final List<String> specialties;
  final Map<String, int> counts;
  final int totalDoctors;
  final String selected;
  final bool isAllSelected;
  final IconData Function(String) iconFor;
  final Color Function(String) bgFor;
  final Color Function(String) iconColorFor;
  final ValueChanged<String> onSelected;
  final VoidCallback onSelectAll;

  const _SpecialtyList({
    required this.context,
    required this.specialties,
    required this.counts,
    required this.totalDoctors,
    required this.selected,
    required this.isAllSelected,
    required this.iconFor,
    required this.bgFor,
    required this.iconColorFor,
    required this.onSelected,
    required this.onSelectAll,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        _buildAllSpecialtiesRow(context),
        const Divider(
          height: 1,
          thickness: 1,
          color: AppColors.outline,
          indent: 20,
          endIndent: 20,
        ),
        ...specialties.map((specialty) {
          final count = counts[specialty] ?? 0;
          final isSelected = !isAllSelected && selected == specialty;
          return _buildSpecialtyRow(
            context: context,
            specialty: specialty,
            count: count,
            isSelected: isSelected,
          );
        }),
      ],
    );
  }

  Widget _buildAllSpecialtiesRow(BuildContext context) {
    final isSelected = isAllSelected;
    return Material(
      color: Colors.transparent,
      child: InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: () {
          HapticFeedback.selectionClick();
          Navigator.of(context).pop();
          onSelectAll();
        },
        child: Container(
          constraints: const BoxConstraints(minHeight: 64),
          margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 2),
          padding: const EdgeInsets.symmetric(horizontal: 12),
          decoration: BoxDecoration(
            color: isSelected
                ? AppColors.secondaryContainer.withValues(alpha: 0.6)
                : Colors.transparent,
            borderRadius: BorderRadius.circular(16),
          ),
          child: Row(
            children: [
              Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                  color: AppColors.primaryFixed,
                  borderRadius: BorderRadius.circular(14),
                ),
                child: Icon(
                  Icons.apps_rounded,
                  color: AppColors.primary,
                  size: 22,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      'All specialties',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: AppTextStyles.bodyMd.copyWith(
                        color: isSelected
                            ? AppColors.onSecondaryFixed
                            : AppColors.onSurface,
                        fontWeight: isSelected
                            ? FontWeight.w700
                            : FontWeight.w500,
                        fontSize: 16,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      '$totalDoctors doctor${totalDoctors == 1 ? '' : 's'}',
                      style: AppTextStyles.bodyMd.copyWith(
                        color: AppColors.onSurfaceVariant,
                        fontSize: 13,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 12),
              SizedBox(
                width: 24,
                height: 24,
                child: isSelected
                    ? const Icon(
                        Icons.check_circle_rounded,
                        color: AppColors.primary,
                        size: 24,
                      )
                    : null,
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildSpecialtyRow({
    required BuildContext context,
    required String specialty,
    required int count,
    required bool isSelected,
  }) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: () {
          HapticFeedback.selectionClick();
          Navigator.of(context).pop();
          onSelected(specialty);
        },
        child: Container(
          constraints: const BoxConstraints(minHeight: 64),
          margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 2),
          padding: const EdgeInsets.symmetric(horizontal: 12),
          decoration: BoxDecoration(
            color: isSelected
                ? AppColors.secondaryContainer.withValues(alpha: 0.6)
                : Colors.transparent,
            borderRadius: BorderRadius.circular(16),
          ),
          child: Row(
            children: [
              Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                  color: bgFor(specialty),
                  borderRadius: BorderRadius.circular(14),
                ),
                child: Icon(
                  iconFor(specialty),
                  color: iconColorFor(specialty),
                  size: 22,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      specialty,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: AppTextStyles.bodyMd.copyWith(
                        color: isSelected
                            ? AppColors.onSecondaryFixed
                            : AppColors.onSurface,
                        fontWeight: isSelected
                            ? FontWeight.w700
                            : FontWeight.w500,
                        fontSize: 16,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      '$count doctor${count == 1 ? '' : 's'}',
                      style: AppTextStyles.bodyMd.copyWith(
                        color: AppColors.onSurfaceVariant,
                        fontSize: 13,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 12),
              SizedBox(
                width: 24,
                height: 24,
                child: isSelected
                    ? const Icon(
                        Icons.check_circle_rounded,
                        color: AppColors.primary,
                        size: 24,
                      )
                    : null,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

Widget _buildEmptyState() {
  return Container(
    margin: const EdgeInsets.symmetric(horizontal: 20, vertical: 32),
    child: Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            Icons.search_off_rounded,
            color: AppColors.outline,
            size: 40,
          ),
          const SizedBox(height: 12),
          Text(
            'No specialties found',
            style: AppTextStyles.bodyMd.copyWith(
              color: AppColors.onSurfaceVariant,
            ),
          ),
        ],
      ),
    ),
  );
}
