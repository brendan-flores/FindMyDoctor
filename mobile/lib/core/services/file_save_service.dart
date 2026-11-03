import 'dart:io';

import 'package:flutter/services.dart';
import 'package:path_provider/path_provider.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:share_plus/share_plus.dart';

/// Result of saving a downloaded file to the device.
class SavedFile {
  /// Absolute path of the file on the device.
  final String path;

  /// Human readable location of the saved file.
  final String displayLocation;

  /// True when the file could not be written to a public folder and the app
  /// opened the system share sheet so the user can pick a destination.
  final bool requiresShareSheet;

  const SavedFile({
    required this.path,
    required this.displayLocation,
    this.requiresShareSheet = false,
  });
}

/// Saves downloaded files to a location the user can access from the device's
/// file manager (Downloads on Android, the Files app on iOS).
class FileSaveService {
  static const MethodChannel _channel =
      MethodChannel('com.example.mobile/files');

  static Future<SavedFile> savePdf(
    List<int> bytes,
    String fileName,
  ) async {
    final data = bytes is Uint8List ? bytes : Uint8List.fromList(bytes);

    if (Platform.isAndroid) {
      return _savePdfToAndroidDownloads(data, fileName);
    }

    if (Platform.isIOS) {
      // With UIFileSharingEnabled and LSSupportsOpeningDocumentsInPlace in
      // Info.plist, files saved here appear in Files > On My iPhone > Mobile.
      final directory = await getApplicationDocumentsDirectory();
      final file = File('${directory.path}/$fileName');
      await file.writeAsBytes(data);
      return SavedFile(
        path: file.path,
        displayLocation: 'Files (On My iPhone > Mobile)',
      );
    }

    final directory = await getDownloadsDirectory() ??
        await getApplicationDocumentsDirectory();
    final file = File('${directory.path}/$fileName');
    await file.writeAsBytes(data);
    return SavedFile(path: file.path, displayLocation: file.path);
  }

  static Future<SavedFile> _savePdfToAndroidDownloads(
    Uint8List bytes,
    String fileName,
  ) async {
    try {
      return await _invokeAndroidSave(bytes, fileName);
    } on MissingPluginException {
      // The native bridge is unavailable (for example when the running build
      // does not include the Android implementation). Hand the PDF to the
      // system share sheet so the user can still store it in Files.
      return _saveWithShareSheet(bytes, fileName);
    } on PlatformException catch (e) {
      // Android 9 and below require the legacy storage permission.
      if (e.code != 'PERMISSION_DENIED') rethrow;

      final status = await Permission.storage.request();
      if (!status.isGranted) {
        return _saveWithShareSheet(bytes, fileName);
      }
      return _invokeAndroidSave(bytes, fileName);
    }
  }

  static Future<SavedFile> _invokeAndroidSave(
    Uint8List bytes,
    String fileName,
  ) async {
    final savedPath = await _channel.invokeMethod<String>(
      'savePdfToDownloads',
      {
        'bytes': bytes,
        'fileName': fileName,
      },
    );

    return SavedFile(
      path: savedPath ?? 'Downloads/FindMyDoctor/$fileName',
      displayLocation: 'Downloads/FindMyDoctor',
    );
  }

  /// Fallback used when the app cannot write directly to a public folder:
  /// stores the PDF in the app cache and opens the system share sheet, which
  /// lets the user save it to Files/Downloads.
  static Future<SavedFile> _saveWithShareSheet(
    Uint8List bytes,
    String fileName,
  ) async {
    final directory = await getTemporaryDirectory();
    final file = File('${directory.path}/$fileName');
    await file.writeAsBytes(bytes);

    await SharePlus.instance.share(
      ShareParams(
        files: [XFile(file.path, mimeType: 'application/pdf')],
        subject: 'Invoice $fileName',
      ),
    );

    return SavedFile(
      path: file.path,
      displayLocation: 'Files',
      requiresShareSheet: true,
    );
  }
}
