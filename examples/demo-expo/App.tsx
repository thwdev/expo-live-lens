import React, { useMemo, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  useWindowDimensions
} from "react-native";
import { LiveLensRoot, useLiveLens } from "./src/dev/live-lens";

const serverUrl = process.env.EXPO_PUBLIC_LIVE_LENS_URL || "http://localhost:4317";
const colors = {
  background: "#f4f6fa",
  surface: "#ffffff",
  text: "#111827",
  muted: "#5b6575",
  line: "#d9e0ea",
  blue: "#1463d9",
  blueSoft: "#eaf2ff",
  red: "#b42318",
  redSoft: "#fff1f0",
  green: "#067647",
  greenSoft: "#e8f7ef"
};

function DemoScreen() {
  const { width } = useWindowDimensions();
  const [count, setCount] = useState(0);
  const [name, setName] = useState("Expo app");
  const lens = useLiveLens({
    serverUrl,
    screenName: "Demo",
    route: "/",
    metadata: {
      source: "demo-expo"
    }
  });

  const layout = useMemo(() => {
    return width > 700 ? "wide" : "compact";
  }, [width]);

  const runNetworkTest = async () => {
    lens.sendEvent("demo-action", { action: "network-test" });
    const response = await fetch("https://jsonplaceholder.typicode.com/todos/1");
    const data = await response.json();
    lens.requestCapture("network-test");
    Alert.alert("Network test", data.title);
  };

  const throwTestError = () => {
    lens.sendEvent("demo-action", { action: "throw-error" });
    throw new Error("Demo error from Expo Live Lens");
  };

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{
        flexGrow: 1,
        gap: 14,
        padding: 20,
        backgroundColor: colors.background
      }}
    >
      <View style={{ gap: 10, paddingTop: 4 }}>
        <Text selectable style={{ color: colors.blue, fontSize: 12, fontWeight: "800" }}>
          EXPO LIVE LENS DEMO
        </Text>
        <Text selectable style={{ color: colors.text, fontSize: 34, fontWeight: "900", lineHeight: 38 }}>
          Live meekijken vanuit Expo Go
        </Text>
        <Text selectable style={{ color: colors.muted, fontSize: 16, lineHeight: 23 }}>
          Deze testapp stuurt screenshots, logs, errors, app-state en netwerk-events naar het lokale dashboard.
        </Text>
        <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
          <View
            style={{
              borderRadius: 999,
              backgroundColor: colors.greenSoft,
              paddingHorizontal: 10,
              paddingVertical: 6
            }}
          >
            <Text style={{ color: colors.green, fontSize: 12, fontWeight: "800" }}>LIVE</Text>
          </View>
          <View
            style={{
              borderRadius: 999,
              backgroundColor: colors.blueSoft,
              paddingHorizontal: 10,
              paddingVertical: 6
            }}
          >
            <Text style={{ color: colors.blue, fontSize: 12, fontWeight: "800" }}>SDK 54</Text>
          </View>
        </View>
      </View>

      <View
        style={{
          gap: 14,
          padding: 14,
          borderRadius: 8,
          borderWidth: 1,
          borderColor: colors.line,
          backgroundColor: colors.surface
        }}
      >
        <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
          <View style={{ flex: 1 }}>
            <Text selectable style={{ color: colors.text, fontSize: 18, fontWeight: "800" }}>
              Status
            </Text>
            <Text selectable style={{ color: colors.muted, marginTop: 3 }}>
              verbonden met Live Lens
            </Text>
          </View>
          <Text selectable style={{ color: colors.blue, fontWeight: "800" }}>
            iOS
          </Text>
        </View>

        <View style={{ flexDirection: "row", gap: 10 }}>
          <View style={{ flex: 1, gap: 4, borderRadius: 8, backgroundColor: colors.background, padding: 10 }}>
            <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "700" }}>LAYOUT</Text>
            <Text selectable style={{ color: colors.text, fontWeight: "800" }}>{layout}</Text>
          </View>
          <View style={{ flex: 1, gap: 4, borderRadius: 8, backgroundColor: colors.background, padding: 10 }}>
            <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "700" }}>COUNTER</Text>
            <Text selectable style={{ color: colors.text, fontWeight: "800", fontVariant: ["tabular-nums"] }}>
              {count}
            </Text>
          </View>
        </View>

        <Text selectable style={{ color: colors.muted, fontSize: 13 }} numberOfLines={1}>
          {serverUrl}
        </Text>
      </View>

      <TextInput
        value={name}
        onChangeText={(value) => {
          setName(value);
          lens.sendEvent("input-change", { field: "name", value });
        }}
        onEndEditing={() => {
          lens.requestCapture("input-change");
        }}
        placeholder="Typ iets om events te sturen"
        style={{
          minHeight: 48,
          borderRadius: 8,
          borderWidth: 1,
          borderColor: colors.line,
          backgroundColor: colors.surface,
          color: colors.text,
          paddingHorizontal: 14,
          fontSize: 16
        }}
      />

      <View style={{ gap: 10 }}>
        <Pressable
          onPress={() => {
            const next = count + 1;
            setCount(next);
            console.log("Counter changed", next);
            lens.sendEvent("counter", { value: next });
            lens.requestCapture("counter");
          }}
          style={{
            alignItems: "center",
            borderRadius: 8,
            backgroundColor: colors.blue,
            padding: 15
          }}
        >
          <Text style={{ color: "#ffffff", fontSize: 16, fontWeight: "700" }}>
            Verhoog counter
          </Text>
        </Pressable>

        <Pressable
          onPress={runNetworkTest}
          style={{
            alignItems: "center",
            borderRadius: 8,
            borderWidth: 1,
            borderColor: colors.blue,
            backgroundColor: colors.blueSoft,
            padding: 15
          }}
        >
          <Text style={{ color: colors.blue, fontSize: 16, fontWeight: "800" }}>
            Test network inspector
          </Text>
        </Pressable>

        <Pressable
          onPress={throwTestError}
          style={{
            alignItems: "center",
            borderRadius: 8,
            borderWidth: 1,
            borderColor: colors.red,
            backgroundColor: colors.redSoft,
            padding: 15
          }}
        >
          <Text style={{ color: colors.red, fontSize: 16, fontWeight: "800" }}>
            Trigger test error
          </Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

export default function App() {
  return (
    <LiveLensRoot
      serverUrl={serverUrl}
      screenName="Demo"
      route="/"
      captureMode="manual"
      captureIntervalMs={2500}
      screenshotQuality={0.58}
      captureNetwork
      metadata={{
        app: "demo-expo"
      }}
    >
      <DemoScreen />
    </LiveLensRoot>
  );
}
