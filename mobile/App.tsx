import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system/legacy";
import * as ImagePicker from "expo-image-picker";
import * as Linking from "expo-linking";
import * as MediaLibrary from "expo-media-library";
import * as Sharing from "expo-sharing";
import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Linking as NativeLinking,
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ||
  "http://localhost:3002";
const STORAGE_KEY = "cloak.fitProfile";
const { height: SCREEN_HEIGHT } = Dimensions.get("window");

type FitProfile = {
  userId: string;
  avatarUrl: string;
};

type Garment = {
  id: string | null;
  image_url: string;
  title: string | null;
  brand: string | null;
  price: string | null;
  source_url: string | null;
  domain: string | null;
  isLocal?: boolean;
};

type TryOn = {
  id: string;
  status: "queued" | "processing" | "finalizing" | "completed" | "failed";
  result_url: string | null;
  error_message: string | null;
};

export default function App() {
  const [profile, setProfile] = useState<FitProfile | null>(null);
  const [garments, setGarments] = useState<Garment[]>([]);
  const [localGarment, setLocalGarment] = useState<Garment | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [productUrl, setProductUrl] = useState("");
  const [isBooting, setIsBooting] = useState(true);
  const [isImporting, setIsImporting] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTryOn, setActiveTryOn] = useState<TryOn | null>(null);
  const pulse = useRef(new Animated.Value(0)).current;

  const feedItems = useMemo(
    () => (localGarment ? [localGarment, ...garments] : garments),
    [garments, localGarment]
  );
  const activeGarment = feedItems[activeIndex] || feedItems[0] || null;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1100,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 1100,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [pulse]);

  useEffect(() => {
    const boot = async () => {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) setProfile(JSON.parse(stored));
      await loadGarments();
      setIsBooting(false);
    };

    boot();
  }, []);

  useEffect(() => {
    const handleUrl = ({ url }: { url: string }) => {
      const parsed = Linking.parse(url);
      const sharedUrl = parsed.queryParams?.url;
      if (typeof sharedUrl === "string") {
        setProductUrl(sharedUrl);
        importProductUrl(sharedUrl);
      }
    };

    Linking.getInitialURL().then((url: string | null) => {
      if (url) handleUrl({ url });
    });

    const subscription = Linking.addEventListener("url", handleUrl);
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (!activeTryOn || activeTryOn.status === "completed" || activeTryOn.status === "failed") {
      return;
    }

    const timeout = setTimeout(async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/tryon/${activeTryOn.id}`);
        if (!response.ok) throw new Error("Could not load try-on status");
        const data = (await response.json()) as TryOn;
        setActiveTryOn(data);
      } catch (error) {
        Alert.alert("Try-on error", error instanceof Error ? error.message : "Please try again.");
      }
    }, 2400);

    return () => clearTimeout(timeout);
  }, [activeTryOn]);

  const loadGarments = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/garments?limit=40`);
      if (!response.ok) throw new Error("Could not load garments");
      const data = await response.json();
      setGarments(data.garments || []);
    } catch {
      setGarments([]);
    }
  };

  const pickProfilePhoto = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permission needed", "Allow photo access to create your fit profile.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.9,
    });

    if (result.canceled || !result.assets[0]) return;

    await createProfile(result.assets[0].uri);
  };

  const createProfile = async (uri: string) => {
    try {
      setIsSubmitting(true);
      const formData = new FormData();
      formData.append("photo", {
        uri,
        name: "fit-photo.jpg",
        type: "image/jpeg",
      } as unknown as Blob);

      const response = await fetch(`${API_BASE_URL}/api/avatar`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) throw new Error("Could not create fit profile");

      const data = await response.json();
      const nextProfile = {
        userId: data.userId,
        avatarUrl: data.avatarUrl,
      };
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(nextProfile));
      setProfile(nextProfile);
    } catch (error) {
      Alert.alert("Profile error", error instanceof Error ? error.message : "Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const importProductUrl = async (url = productUrl) => {
    if (!url.trim()) return;

    try {
      setIsImporting(true);
      const response = await fetch(`${API_BASE_URL}/api/scrape-garment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });

      if (!response.ok) throw new Error("Could not import that item");

      const data = await response.json();
      const garment = data.garment as Garment;
      setLocalGarment(null);
      setGarments((current) => [
        garment,
        ...current.filter((item) => item.id !== garment.id),
      ]);
      setActiveIndex(0);
      setProductUrl("");
    } catch (error) {
      Alert.alert("Import failed", error instanceof Error ? error.message : "Upload a screenshot instead.");
    } finally {
      setIsImporting(false);
    }
  };

  const pickGarmentImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permission needed", "Allow photo access to upload garment screenshots.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.92,
      base64: true,
    });

    if (result.canceled || !result.assets[0]) return;

    const asset = result.assets[0];
    setLocalGarment({
      id: null,
      image_url: `data:image/jpeg;base64,${asset.base64}`,
      title: asset.fileName?.replace(/\.[^.]+$/, "") || "Uploaded garment",
      brand: "Uploaded",
      price: null,
      source_url: null,
      domain: null,
      isLocal: true,
    });
    setActiveIndex(0);
  };

  const startTryOn = async () => {
    if (!profile || !activeGarment) return;

    try {
      setIsSubmitting(true);
      const response = await fetch(`${API_BASE_URL}/api/tryon`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: profile.userId,
          avatarUrl: profile.avatarUrl,
          garmentId: activeGarment.id,
          garmentImageUrl: activeGarment.isLocal ? null : activeGarment.image_url,
          garmentImageBase64: activeGarment.isLocal ? activeGarment.image_url : null,
        }),
      });

      if (!response.ok) throw new Error("Could not start try-on");

      const data = await response.json();
      setActiveTryOn({
        id: data.tryonId,
        status: "processing",
        result_url: null,
        error_message: null,
      });
    } catch (error) {
      Alert.alert("Try-on failed", error instanceof Error ? error.message : "Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const saveResult = async () => {
    if (!activeTryOn?.result_url) return;

    const permission = await MediaLibrary.requestPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permission needed", "Allow photo access to save your result.");
      return;
    }

    const file = await FileSystem.downloadAsync(
      activeTryOn.result_url,
      `${FileSystem.documentDirectory}cloak-${activeTryOn.id}.jpg`
    );
    await MediaLibrary.saveToLibraryAsync(file.uri);
    Alert.alert("Saved", "Try-on saved to your photo library.");
  };

  const shareResult = async () => {
    if (!activeTryOn?.result_url) return;

    const file = await FileSystem.downloadAsync(
      activeTryOn.result_url,
      `${FileSystem.cacheDirectory}cloak-${activeTryOn.id}.jpg`
    );

    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(file.uri);
    }
  };

  const openProduct = () => {
    if (activeGarment?.source_url) NativeLinking.openURL(activeGarment.source_url);
  };

  if (isBooting) {
    return <LoadingScreen label="Loading Cloak" />;
  }

  if (!profile) {
    return (
      <SafeAreaView style={styles.onboarding}>
        <StatusBar style="dark" />
        <View style={styles.onboardingHero}>
          <Text style={styles.kicker}>Cloak</Text>
          <Text style={styles.onboardingTitle}>Create your fit photo</Text>
          <Text style={styles.onboardingText}>
            Use one clear photo. Cloak will use it as the model image for try-on generation.
          </Text>
        </View>
        <Pressable
          disabled={isSubmitting}
          onPress={pickProfilePhoto}
          style={styles.primaryLightButton}
        >
          <Text style={styles.primaryLightButtonText}>
            {isSubmitting ? "Uploading..." : "Choose Fit Photo"}
          </Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  if (activeTryOn) {
    return (
      <ResultView
        tryOn={activeTryOn}
        pulse={pulse}
        onClose={() => setActiveTryOn(null)}
        onSave={saveResult}
        onShare={shareResult}
      />
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <FlatList
        data={feedItems}
        keyExtractor={(item) => item.id || item.image_url}
        pagingEnabled
        showsVerticalScrollIndicator={false}
        snapToInterval={SCREEN_HEIGHT}
        decelerationRate="fast"
        onMomentumScrollEnd={(event) => {
          const nextIndex = Math.round(event.nativeEvent.contentOffset.y / SCREEN_HEIGHT);
          setActiveIndex(Math.min(Math.max(nextIndex, 0), Math.max(feedItems.length - 1, 0)));
        }}
        ListEmptyComponent={<EmptyFeed isLoading={false} />}
        renderItem={({ item }) => (
          <View style={styles.feedItem}>
            <Image source={{ uri: item.image_url }} resizeMode="contain" style={styles.feedImage} />
            <View style={styles.feedShade} />
          </View>
        )}
      />

      {!feedItems.length && <EmptyFeed isLoading={false} />}

      <SafeAreaView pointerEvents="box-none" style={styles.overlay}>
        <View style={styles.header}>
          <View>
            <Text style={styles.kickerDark}>Cloak</Text>
            <Text style={styles.headerTitle}>Fit feed</Text>
          </View>
          <Pressable onPress={pickProfilePhoto} style={styles.avatarButton}>
            <Image source={{ uri: profile.avatarUrl }} style={styles.avatarImage} />
          </Pressable>
        </View>

        <View style={styles.actionRail}>
          <RailButton label="Photo" onPress={pickProfilePhoto} />
          <RailButton label="Upload" onPress={pickGarmentImage} />
          {activeGarment?.source_url && <RailButton label="Open" onPress={openProduct} />}
        </View>

        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.bottomDock}
        >
          <View style={styles.captionBlock}>
            <Text numberOfLines={1} style={styles.captionTitle}>
              {activeGarment?.title || "Add an item to the feed"}
            </Text>
            <Text numberOfLines={1} style={styles.captionMeta}>
              {[activeGarment?.brand, activeGarment?.price || activeGarment?.domain]
                .filter(Boolean)
                .join(" / ") || "Paste a link or upload a screenshot"}
            </Text>
          </View>

          <View style={styles.modeRow}>
            <Pressable
              onPress={() => setProductUrl(productUrl)}
              style={[styles.modeButton, styles.modeButtonActive]}
            >
              <Text style={styles.modeButtonActiveText}>URL</Text>
            </Pressable>
            <Pressable onPress={pickGarmentImage} style={styles.modeButton}>
              <Text style={styles.modeButtonText}>Upload</Text>
            </Pressable>
          </View>

          <View style={styles.urlRow}>
            <TextInput
              value={productUrl}
              onChangeText={setProductUrl}
              placeholder="Paste product URL"
              placeholderTextColor="#9b948d"
              autoCapitalize="none"
              style={styles.urlInput}
            />
            <Pressable
              disabled={!productUrl.trim() || isImporting}
              onPress={() => importProductUrl()}
              style={styles.urlSubmit}
            >
              {isImporting ? (
                <ActivityIndicator color="#171412" />
              ) : (
                <Text style={styles.urlSubmitText}>Go</Text>
              )}
            </Pressable>
          </View>

          <Pressable
            disabled={!activeGarment || isSubmitting}
            onPress={startTryOn}
            style={[styles.tryButton, (!activeGarment || isSubmitting) && styles.disabledButton]}
          >
            <Text style={styles.tryButtonText}>
              {activeGarment ? "Try This On" : "Add a Garment"}
            </Text>
          </Pressable>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

function LoadingScreen({ label }: { label: string }) {
  return (
    <View style={styles.loadingScreen}>
      <ActivityIndicator color="#ffffff" />
      <Text style={styles.loadingText}>{label}</Text>
    </View>
  );
}

function EmptyFeed({ isLoading }: { isLoading: boolean }) {
  return (
    <View style={styles.emptyFeed}>
      <Text style={styles.emptyIcon}>C</Text>
      <Text style={styles.emptyTitle}>{isLoading ? "Loading feed" : "Swipe into your next look"}</Text>
      <Text style={styles.emptyText}>
        {isLoading
          ? "Pulling saved garments into Cloak."
          : "Paste a product URL or upload a garment screenshot."}
      </Text>
    </View>
  );
}

function RailButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.railButton}>
      <Text style={styles.railButtonText}>{label[0]}</Text>
    </Pressable>
  );
}

function ResultView({
  tryOn,
  pulse,
  onClose,
  onSave,
  onShare,
}: {
  tryOn: TryOn;
  pulse: Animated.Value;
  onClose: () => void;
  onSave: () => void;
  onShare: () => void;
}) {
  if (tryOn.status === "failed") {
    return (
      <SafeAreaView style={styles.resultShell}>
        <Text style={styles.resultTitle}>Try-on failed</Text>
        <Text style={styles.resultText}>{tryOn.error_message || "Please try another item."}</Text>
        <Pressable onPress={onClose} style={styles.primaryDarkButton}>
          <Text style={styles.primaryDarkButtonText}>Back to Feed</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  if (tryOn.status !== "completed" || !tryOn.result_url) {
    const opacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] });
    return (
      <View style={styles.resultLoading}>
        <Animated.View style={[styles.scanCard, { opacity }]} />
        <Text style={styles.loadingText}>Generating your look</Text>
        <Text style={styles.resultText}>Cloak will reveal it here when ready.</Text>
      </View>
    );
  }

  return (
    <View style={styles.resultFull}>
      <Image source={{ uri: tryOn.result_url }} resizeMode="contain" style={styles.resultImage} />
      <SafeAreaView style={styles.resultOverlay}>
        <View style={styles.resultRail}>
          <RailButton label="Save" onPress={onSave} />
          <RailButton label="Share" onPress={onShare} />
        </View>
        <View style={styles.resultDock}>
          <Text style={styles.captionTitle}>Your look is ready</Text>
          <Text style={styles.captionMeta}>Save it, share it, or keep swiping.</Text>
          <Pressable onPress={onClose} style={styles.tryButton}>
            <Text style={styles.tryButtonText}>Try Another</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#171412",
  },
  loadingScreen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#171412",
  },
  loadingText: {
    marginTop: 14,
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "700",
  },
  onboarding: {
    flex: 1,
    justifyContent: "space-between",
    backgroundColor: "#f7f4ef",
    padding: 22,
  },
  onboardingHero: {
    flex: 1,
    justifyContent: "center",
  },
  kicker: {
    color: "#756f68",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  onboardingTitle: {
    marginTop: 10,
    color: "#171412",
    fontSize: 36,
    fontWeight: "800",
  },
  onboardingText: {
    marginTop: 14,
    color: "#756f68",
    fontSize: 15,
    lineHeight: 23,
  },
  primaryLightButton: {
    height: 54,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#171412",
  },
  primaryLightButtonText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "800",
  },
  primaryDarkButton: {
    height: 54,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffffff",
    paddingHorizontal: 22,
  },
  primaryDarkButtonText: {
    color: "#171412",
    fontSize: 15,
    fontWeight: "800",
  },
  feedItem: {
    height: SCREEN_HEIGHT,
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#171412",
  },
  feedImage: {
    height: "100%",
    width: "100%",
    paddingTop: 84,
    paddingBottom: 230,
    paddingHorizontal: 24,
  },
  feedShade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.08)",
  },
  emptyFeed: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 34,
    paddingBottom: 160,
    backgroundColor: "#171412",
  },
  emptyIcon: {
    marginBottom: 20,
    color: "#ffffff",
    fontSize: 34,
    fontWeight: "900",
  },
  emptyTitle: {
    color: "#ffffff",
    textAlign: "center",
    fontSize: 32,
    fontWeight: "800",
  },
  emptyText: {
    marginTop: 12,
    color: "rgba(255,255,255,0.66)",
    textAlign: "center",
    fontSize: 15,
    lineHeight: 23,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "space-between",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  kickerDark: {
    color: "rgba(255,255,255,0.56)",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  headerTitle: {
    marginTop: 3,
    color: "#ffffff",
    fontSize: 20,
    fontWeight: "800",
  },
  avatarButton: {
    height: 48,
    width: 48,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
  },
  avatarImage: {
    height: "100%",
    width: "100%",
  },
  actionRail: {
    position: "absolute",
    right: 16,
    top: SCREEN_HEIGHT * 0.36,
    gap: 14,
  },
  railButton: {
    height: 50,
    width: 50,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    backgroundColor: "rgba(0,0,0,0.34)",
  },
  railButtonText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "900",
  },
  bottomDock: {
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.1)",
    backgroundColor: "rgba(23,20,18,0.92)",
    padding: 18,
    gap: 10,
  },
  captionBlock: {
    marginBottom: 2,
  },
  captionTitle: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "800",
  },
  captionMeta: {
    marginTop: 3,
    color: "rgba(255,255,255,0.58)",
    fontSize: 13,
  },
  modeRow: {
    flexDirection: "row",
    gap: 8,
  },
  modeButton: {
    flex: 1,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  modeButtonActive: {
    borderColor: "#ffffff",
    backgroundColor: "#ffffff",
  },
  modeButtonText: {
    color: "rgba(255,255,255,0.75)",
    fontWeight: "800",
  },
  modeButtonActiveText: {
    color: "#171412",
    fontWeight: "800",
  },
  urlRow: {
    flexDirection: "row",
    gap: 8,
  },
  urlInput: {
    flex: 1,
    height: 50,
    backgroundColor: "#ffffff",
    paddingHorizontal: 14,
    color: "#171412",
    fontSize: 14,
  },
  urlSubmit: {
    height: 50,
    width: 52,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffffff",
  },
  urlSubmitText: {
    color: "#171412",
    fontWeight: "900",
  },
  tryButton: {
    height: 52,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffffff",
  },
  tryButtonText: {
    color: "#171412",
    fontSize: 15,
    fontWeight: "900",
  },
  disabledButton: {
    opacity: 0.42,
  },
  resultShell: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#171412",
    padding: 24,
  },
  resultTitle: {
    color: "#ffffff",
    fontSize: 24,
    fontWeight: "900",
  },
  resultText: {
    marginTop: 10,
    marginBottom: 22,
    color: "rgba(255,255,255,0.66)",
    textAlign: "center",
    fontSize: 14,
    lineHeight: 21,
  },
  resultLoading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#171412",
    padding: 24,
  },
  scanCard: {
    height: 190,
    width: 150,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.22)",
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  resultFull: {
    flex: 1,
    backgroundColor: "#171412",
  },
  resultImage: {
    flex: 1,
    width: "100%",
  },
  resultOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "flex-end",
  },
  resultRail: {
    position: "absolute",
    right: 16,
    top: SCREEN_HEIGHT * 0.42,
    gap: 14,
  },
  resultDock: {
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.1)",
    backgroundColor: "rgba(23,20,18,0.92)",
    padding: 18,
    gap: 10,
  },
});
