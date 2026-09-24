pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}

dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
        // getstream webrtc-android (maintained fork of the official Google WebRTC builds)
        maven { url = uri("https://jitpack.io") }
    }
}

rootProject.name = "Remote365AndroidHost"
include(":app")
