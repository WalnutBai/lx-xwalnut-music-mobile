package com.lxwalnut.music.mobile;

import com.facebook.react.PackageList;
import com.facebook.react.flipper.ReactNativeFlipper;
import android.os.Bundle;
import com.reactnativenavigation.NavigationApplication;
import com.facebook.react.ReactNativeHost;
import com.facebook.react.ReactPackage;
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint;
import com.reactnativenavigation.react.NavigationReactNativeHost;
import java.util.List;

import com.lxwalnut.music.mobile.cache.CachePackage;
import com.lxwalnut.music.mobile.crypto.CryptoPackage;
import com.lxwalnut.music.mobile.lyric.LyricPackage;
import com.lxwalnut.music.mobile.userApi.UserApiPackage;
import com.lxwalnut.music.mobile.utils.UtilsPackage;
import com.lxwalnut.music.mobile.widget.WidgetPackage;

public class MainApplication extends NavigationApplication {

  private final ReactNativeHost mReactNativeHost =
      new NavigationReactNativeHost(this) {
        @Override
        public boolean getUseDeveloperSupport() {
          return BuildConfig.DEBUG;
        }

        @Override
        protected List<ReactPackage> getPackages() {
          @SuppressWarnings("UnnecessaryLocalVariable")
          List<ReactPackage> packages = new PackageList(this).getPackages();
          // Packages that cannot be autolinked yet can be added manually here, for example:
          // packages.add(new MyReactNativePackage());
          packages.add(new CachePackage());
          packages.add(new LyricPackage());
          packages.add(new UtilsPackage());
          packages.add(new CryptoPackage());
          packages.add(new UserApiPackage());
          packages.add(new WidgetPackage());
          return packages;
        }

        @Override
        protected String getJSMainModuleName() {
          return "index";
        }

        @Override
        protected boolean isNewArchEnabled() {
          return BuildConfig.IS_NEW_ARCHITECTURE_ENABLED;
        }

        @Override
        protected Boolean isHermesEnabled() {
          return BuildConfig.IS_HERMES_ENABLED;
        }
      };

  @Override
  public ReactNativeHost getReactNativeHost() {
    return mReactNativeHost;
  }

  @Override
  public void onCreate() {
    super.onCreate();

    if (BuildConfig.IS_NEW_ARCHITECTURE_ENABLED) {
      // If you opted-in for the New Architecture, we load the native entry point for this app.
      DefaultNewArchitectureEntryPoint.load();
    }
    if (System.getenv("NO_FLIPPER") == null) {
      ReactNativeFlipper.initializeFlipper(this, getReactNativeHost().getReactInstanceManager());
    }
  }
}
