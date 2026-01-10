import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Dimensions, Animated } from 'react-native';
import { Image } from 'expo-image';

const { width, height } = Dimensions.get('window');

interface AnimatedSplashProps {
  onAnimationEnd: () => void;
}

export default function AnimatedSplash({ onAnimationEnd }: AnimatedSplashProps) {
  const [fadeAnim] = useState(new Animated.Value(1));

  useEffect(() => {
    // Let the GIF play for a bit, then fade out
    const timer = setTimeout(() => {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }).start(() => {
        onAnimationEnd();
      });
    }, 2500); // Show splash for 2.5 seconds

    return () => clearTimeout(timer);
  }, [fadeAnim, onAnimationEnd]);

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <View style={styles.imageContainer}>
        <Image
          source={require('@/assets/images/splash-animated.gif')}
          style={styles.image}
          contentFit="cover"
          autoplay={true}
        />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#C9A87C',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  imageContainer: {
    width: width,
    height: height,
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    width: width,
    height: height,
  },
});
