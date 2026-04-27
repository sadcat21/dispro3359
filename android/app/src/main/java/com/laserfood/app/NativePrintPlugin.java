package com.laserfood.app;

import android.content.Context;
import android.os.Build;
import android.print.PrintAttributes;
import android.print.PrintDocumentAdapter;
import android.print.PrintJob;
import android.print.PrintManager;
import android.webkit.WebView;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "NativePrint")
public class NativePrintPlugin extends Plugin {
    @PluginMethod
    public void printCurrentPage(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            try {
                WebView webView = getBridge().getWebView();
                PrintManager printManager = (PrintManager) getContext().getSystemService(Context.PRINT_SERVICE);

                if (webView == null || printManager == null) {
                    call.reject("خدمة الطباعة غير متاحة على هذا الجهاز");
                    return;
                }

                String jobName = call.getString("jobName", "Laser Food");
                PrintDocumentAdapter adapter;
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                    adapter = webView.createPrintDocumentAdapter(jobName);
                } else {
                    call.reject("إصدار أندرويد لا يدعم الطباعة الأصلية");
                    return;
                }

                PrintJob printJob = printManager.print(
                        jobName,
                        adapter,
                        new PrintAttributes.Builder()
                                .setMediaSize(PrintAttributes.MediaSize.ISO_A4)
                                .setColorMode(PrintAttributes.COLOR_MODE_COLOR)
                                .build()
                );

                JSObject result = new JSObject();
                result.put("jobId", printJob.getId().toString());
                call.resolve(result);
            } catch (Exception e) {
                call.reject(e.getMessage() != null ? e.getMessage() : "تعذر فتح خيارات الطباعة", e);
            }
        });
    }
}