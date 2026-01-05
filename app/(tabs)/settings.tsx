import { StyleSheet, View, Text, TouchableOpacity, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Coins, Palette, User, ChevronRight, CreditCard } from "lucide-react-native";
import React from "react";
import Colors from "@/constants/colors";
import { useApp } from "@/contexts/AppContext";

export default function SettingsScreen() {
  const { credits } = useApp();

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Settings</Text>
      </View>

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Credits & Billing</Text>
          <View style={styles.card}>
            <View style={styles.creditsRow}>
              <View style={styles.creditsIcon}>
                <Coins size={24} color={Colors.light.accent} />
              </View>
              <View style={styles.creditsInfo}>
                <Text style={styles.creditsBalance}>{credits}</Text>
                <Text style={styles.creditsLabel}>Credits available</Text>
              </View>
            </View>
            <TouchableOpacity style={styles.buyButton} activeOpacity={0.8}>
              <CreditCard size={18} color={Colors.light.surface} />
              <Text style={styles.buyButtonText}>Buy Credits</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Brand Kit</Text>
            <View style={styles.comingSoonBadge}>
              <Text style={styles.comingSoonText}>Soon</Text>
            </View>
          </View>
          <View style={[styles.card, styles.cardDisabled]}>
            <View style={styles.settingRow}>
              <View style={styles.settingLeft}>
                <View style={[styles.settingIcon, { backgroundColor: '#E8F4EC' }]}>
                  <Palette size={18} color="#5AAB61" />
                </View>
                <View>
                  <Text style={[styles.settingLabel, styles.textDisabled]}>Upload Logo</Text>
                  <Text style={[styles.settingHint, styles.textDisabled]}>Add your clinic logo</Text>
                </View>
              </View>
              <ChevronRight size={20} color={Colors.light.border} />
            </View>
            
            <View style={styles.divider} />
            
            <View style={styles.settingRow}>
              <View style={styles.settingLeft}>
                <View style={[styles.settingIcon, { backgroundColor: '#FEF3E6' }]}>
                  <Palette size={18} color="#E5A43B" />
                </View>
                <View>
                  <Text style={[styles.settingLabel, styles.textDisabled]}>Brand Color</Text>
                  <Text style={[styles.settingHint, styles.textDisabled]}>Not set</Text>
                </View>
              </View>
              <ChevronRight size={20} color={Colors.light.border} />
            </View>
            
            <View style={styles.divider} />
            
            <View style={styles.settingRow}>
              <View style={styles.settingLeft}>
                <View style={[styles.settingIcon, { backgroundColor: '#EEE8F8' }]}>
                  <Palette size={18} color="#8B5CF6" />
                </View>
                <View>
                  <Text style={[styles.settingLabel, styles.textDisabled]}>Auto-apply Logo</Text>
                  <Text style={[styles.settingHint, styles.textDisabled]}>Add logo to exports</Text>
                </View>
              </View>
              <ChevronRight size={20} color={Colors.light.border} />
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          <View style={styles.card}>
            <TouchableOpacity style={styles.settingRow} activeOpacity={0.7}>
              <View style={styles.settingLeft}>
                <View style={[styles.settingIcon, { backgroundColor: Colors.light.surfaceSecondary }]}>
                  <User size={18} color={Colors.light.textSecondary} />
                </View>
                <View>
                  <Text style={styles.settingLabel}>Sign In</Text>
                  <Text style={styles.settingHint}>Access your account</Text>
                </View>
              </View>
              <ChevronRight size={20} color={Colors.light.textTertiary} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.aiRulesSection}>
          <Text style={styles.aiRulesTitle}>Clinic-Safe Processing</Text>
          <Text style={styles.aiRulesText}>
            Our AI only applies presentation enhancements (lighting, color, background). We never alter facial features, body shape, or treatment outcomes.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
  },
  title: {
    fontSize: 32,
    fontWeight: '700' as const,
    color: Colors.light.text,
    letterSpacing: -0.5,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 120,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    marginLeft: 4,
    gap: 8,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.light.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  comingSoonBadge: {
    backgroundColor: Colors.light.accent,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  comingSoonText: {
    fontSize: 9,
    fontWeight: '700' as const,
    color: Colors.light.surface,
    textTransform: 'uppercase',
  },
  cardDisabled: {
    opacity: 0.5,
  },
  textDisabled: {
    color: Colors.light.textTertiary,
  },
  card: {
    backgroundColor: Colors.light.surface,
    borderRadius: 16,
    overflow: 'hidden',
  },
  creditsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 14,
  },
  creditsIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: Colors.light.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  creditsInfo: {
    flex: 1,
  },
  creditsBalance: {
    fontSize: 32,
    fontWeight: '700' as const,
    color: Colors.light.text,
    letterSpacing: -0.5,
  },
  creditsLabel: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    marginTop: 2,
  },
  buyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.light.text,
    marginHorizontal: 16,
    marginBottom: 16,
    paddingVertical: 14,
    borderRadius: 12,
  },
  buyButtonText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.light.surface,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  settingIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '500' as const,
    color: Colors.light.text,
  },
  settingHint: {
    fontSize: 13,
    color: Colors.light.textSecondary,
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.light.borderLight,
    marginLeft: 68,
  },
  aiRulesSection: {
    backgroundColor: Colors.light.surfaceSecondary,
    borderRadius: 16,
    padding: 16,
    marginTop: 8,
  },
  aiRulesTitle: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.light.text,
    marginBottom: 6,
  },
  aiRulesText: {
    fontSize: 13,
    color: Colors.light.textSecondary,
    lineHeight: 20,
  },
});
