package com.example.mobile

import android.content.ContentValues
import android.os.Build
import android.os.Environment
import android.provider.MediaStore
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel
import java.io.File
import java.io.FileOutputStream

class MainActivity : FlutterActivity() {
    private val filesChannel = "com.example.mobile/files"

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)

        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, filesChannel)
            .setMethodCallHandler { call, result ->
                if (call.method != "savePdfToDownloads") {
                    result.notImplemented()
                    return@setMethodCallHandler
                }

                val bytes = call.argument<ByteArray>("bytes")
                val fileName = call.argument<String>("fileName")

                if (bytes == null || fileName.isNullOrBlank()) {
                    result.error(
                        "INVALID_ARGUMENTS",
                        "Missing PDF bytes or file name",
                        null
                    )
                    return@setMethodCallHandler
                }

                try {
                    result.success(savePdfToDownloads(bytes, fileName))
                } catch (e: SecurityException) {
                    result.error("PERMISSION_DENIED", e.message, null)
                } catch (e: Exception) {
                    result.error("SAVE_FAILED", e.message, null)
                }
            }
    }

    private fun savePdfToDownloads(bytes: ByteArray, fileName: String): String {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            val resolver = applicationContext.contentResolver
            val values = ContentValues().apply {
                put(MediaStore.MediaColumns.DISPLAY_NAME, fileName)
                put(MediaStore.MediaColumns.MIME_TYPE, "application/pdf")
                put(
                    MediaStore.MediaColumns.RELATIVE_PATH,
                    "${Environment.DIRECTORY_DOWNLOADS}/FindMyDoctor"
                )
                put(MediaStore.MediaColumns.IS_PENDING, 1)
            }

            val uri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values)
                ?: throw IllegalStateException("Could not create the invoice file in Downloads")

            try {
                resolver.openOutputStream(uri)?.use { output ->
                    output.write(bytes)
                } ?: throw IllegalStateException("Could not open the invoice file for writing")

                values.clear()
                values.put(MediaStore.MediaColumns.IS_PENDING, 0)
                resolver.update(uri, values, null, null)
            } catch (e: Exception) {
                resolver.delete(uri, null, null)
                throw e
            }

            return "${Environment.DIRECTORY_DOWNLOADS}/FindMyDoctor/$fileName"
        }

        @Suppress("DEPRECATION")
        val downloads = Environment.getExternalStoragePublicDirectory(
            Environment.DIRECTORY_DOWNLOADS
        )
        val directory = File(downloads, "FindMyDoctor")
        if (!directory.exists() && !directory.mkdirs()) {
            throw IllegalStateException("Could not create the Downloads/FindMyDoctor folder")
        }

        val file = File(directory, fileName)
        FileOutputStream(file).use { output ->
            output.write(bytes)
        }
        return file.absolutePath
    }
}
