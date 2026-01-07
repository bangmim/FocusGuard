import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Easing } from 'react-native';
import { CharacterStatus } from '../store/characterStore';

interface AnimatedCharacterProps {
  status: CharacterStatus;
  size?: number;
}

const AnimatedCharacter: React.FC<AnimatedCharacterProps> = ({
  status,
  size = 120,
}) => {
  const bounceAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // 부드러운 바운스 애니메이션
    Animated.loop(
      Animated.sequence([
        Animated.timing(bounceAnim, {
          toValue: -10,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(bounceAnim, {
          toValue: 0,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    ).start();

    // 펄스 애니메이션 (상태에 따라 다르게)
    if (status === 'CRYING') {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.1,
            duration: 500,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 500,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
      ).start();
    } else if (status === 'SLEEPING') {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 0.95,
            duration: 2000,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 2000,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
      ).start();
    }

    // 회전 애니메이션 (EGG 상태일 때)
    if (status === 'EGG') {
      Animated.loop(
        Animated.timing(rotateAnim, {
          toValue: 1,
          duration: 3000,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      ).start();
    }
  }, [status, bounceAnim, pulseAnim, rotateAnim]);

  const spin = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const getCharacterColors = () => {
    switch (status) {
      case 'EGG':
        return {
          primary: '#FFD54F',
          secondary: '#FFF9C4',
          accent: '#FFC107',
        };
      case 'BABY':
        return {
          primary: '#66BB6A',
          secondary: '#A5D6A7',
          accent: '#4CAF50',
        };
      case 'CRYING':
        return {
          primary: '#FFA726',
          secondary: '#FFCC80',
          accent: '#FF9800',
        };
      case 'SLEEPING':
        return {
          primary: '#42A5F5',
          secondary: '#90CAF9',
          accent: '#2196F3',
        };
      default:
        return {
          primary: '#FFD54F',
          secondary: '#FFF9C4',
          accent: '#FFC107',
        };
    }
  };

  return (
    <Animated.View
      style={[
        styles.container,
        {
          width: size,
          height: size,
          transform: [
            { translateY: bounceAnim },
            { scale: pulseAnim },
            { rotate: status === 'EGG' ? spin : '0deg' },
          ],
        },
      ]}
    >
      <View style={styles.characterBase}>
        <View
          style={[
            styles.characterGradient,
            {
              backgroundColor: getCharacterColors().primary,
            },
          ]}
        />
        <View
          style={[
            styles.characterGradientOverlay,
            {
              backgroundColor: getCharacterColors().secondary,
            },
          ]}
        />
        {/* EGG 상태 */}
        {status === 'EGG' && (
          <>
            <View
              style={[
                styles.eggBody,
                { backgroundColor: getCharacterColors().secondary },
              ]}
            />
            <View style={styles.eggHighlight} />
            <View style={styles.eggPattern} />
          </>
        )}

        {/* BABY 상태 */}
        {status === 'BABY' && (
          <>
            <View
              style={[
                styles.head,
                { backgroundColor: getCharacterColors().secondary },
              ]}
            />
            <View
              style={[
                styles.body,
                { backgroundColor: getCharacterColors().secondary },
              ]}
            />
            <View style={styles.cheek} />
            <View style={[styles.cheek, { right: size * 0.2 }]} />
            <View style={styles.eye} />
            <View style={[styles.eye, { left: size * 0.35 }]} />
            <View style={styles.mouth} />
          </>
        )}

        {/* CRYING 상태 */}
        {status === 'CRYING' && (
          <>
            <View
              style={[
                styles.head,
                { backgroundColor: getCharacterColors().secondary },
              ]}
            />
            <View
              style={[
                styles.body,
                { backgroundColor: getCharacterColors().secondary },
              ]}
            />
            <View style={styles.cryingEye} />
            <View style={[styles.cryingEye, { left: size * 0.35 }]} />
            <View style={styles.cryingMouth} />
            <View style={styles.tear} />
            <View style={[styles.tear, { left: size * 0.35 }]} />
            <View style={[styles.tear, { top: '55%' }]} />
            <View style={[styles.tear, { left: size * 0.35, top: '55%' }]} />
          </>
        )}

        {/* SLEEPING 상태 */}
        {status === 'SLEEPING' && (
          <>
            <View
              style={[
                styles.head,
                { backgroundColor: getCharacterColors().secondary },
              ]}
            />
            <View
              style={[
                styles.body,
                { backgroundColor: getCharacterColors().secondary },
              ]}
            />
            <View style={styles.sleepingEye} />
            <View style={[styles.sleepingEye, { left: size * 0.35 }]} />
            <View style={styles.sleepingMouth} />
            <View style={styles.sleepBubble} />
            <View
              style={[
                styles.sleepBubble,
                { width: 8, height: 8, top: '20%', right: '12%' },
              ]}
            />
            <View style={styles.zzz1}>Z</View>
            <View style={styles.zzz2}>Z</View>
            <View style={styles.zzz3}>Z</View>
          </>
        )}
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  characterBase: {
    width: '100%',
    height: '100%',
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 6,
    },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 12,
  },
  characterGradient: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    borderRadius: 60,
  },
  characterGradientOverlay: {
    position: 'absolute',
    width: '70%',
    height: '70%',
    borderRadius: 40,
    top: '10%',
    left: '15%',
    opacity: 0.6,
  },
  // EGG 스타일
  egg: {
    borderRadius: 50,
  },
  eggBody: {
    width: '80%',
    height: '90%',
    borderRadius: 50,
    position: 'absolute',
  },
  eggHighlight: {
    width: '30%',
    height: '30%',
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    borderRadius: 20,
    position: 'absolute',
    top: '20%',
    left: '25%',
  },
  eggPattern: {
    width: '15%',
    height: '20%',
    backgroundColor: 'rgba(255, 193, 7, 0.3)',
    borderRadius: 15,
    position: 'absolute',
    bottom: '25%',
    left: '30%',
  },
  // BABY 스타일
  head: {
    width: '60%',
    height: '50%',
    borderRadius: 40,
    position: 'absolute',
    top: '10%',
  },
  body: {
    width: '70%',
    height: '50%',
    borderRadius: 35,
    position: 'absolute',
    bottom: '5%',
  },
  cheek: {
    width: '12%',
    height: '10%',
    backgroundColor: 'rgba(255, 182, 193, 0.6)',
    borderRadius: 20,
    position: 'absolute',
    top: '40%',
    left: '15%',
  },
  eye: {
    width: '10%',
    height: '10%',
    backgroundColor: '#333',
    borderRadius: 10,
    position: 'absolute',
    top: '35%',
    left: '30%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
  },
  mouth: {
    width: '18%',
    height: '10%',
    backgroundColor: '#FF6B6B',
    borderRadius: 12,
    position: 'absolute',
    top: '50%',
    left: '41%',
  },
  // CRYING 스타일
  cryingEye: {
    width: '10%',
    height: '10%',
    backgroundColor: '#333',
    borderRadius: 10,
    position: 'absolute',
    top: '35%',
    left: '30%',
  },
  cryingMouth: {
    width: '22%',
    height: '12%',
    borderBottomWidth: 4,
    borderBottomColor: '#FF6B6B',
    borderRadius: 50,
    position: 'absolute',
    top: '50%',
    left: '39%',
  },
  tear: {
    width: '5%',
    height: '10%',
    backgroundColor: '#64B5F6',
    borderRadius: 15,
    position: 'absolute',
    top: '45%',
    left: '30%',
    shadowColor: '#64B5F6',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 3,
  },
  // SLEEPING 스타일
  sleepingEye: {
    width: '14%',
    height: '2%',
    borderBottomWidth: 3,
    borderBottomColor: '#333',
    borderRadius: 10,
    position: 'absolute',
    top: '35%',
    left: '27%',
  },
  sleepingMouth: {
    width: '18%',
    height: '10%',
    borderTopWidth: 4,
    borderTopColor: '#FF6B6B',
    borderRadius: 50,
    position: 'absolute',
    top: '50%',
    left: '41%',
  },
  sleepBubble: {
    width: 12,
    height: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderRadius: 10,
    position: 'absolute',
    top: '15%',
    right: '15%',
    borderWidth: 1,
    borderColor: 'rgba(200, 200, 200, 0.5)',
  },
  zzz1: {
    position: 'absolute',
    top: '12%',
    right: '18%',
    fontSize: 18,
    fontWeight: 'bold',
    color: '#999',
    transform: [{ rotate: '15deg' }],
  },
  zzz2: {
    position: 'absolute',
    top: '18%',
    right: '12%',
    fontSize: 16,
    fontWeight: 'bold',
    color: '#999',
    transform: [{ rotate: '-10deg' }],
  },
  zzz3: {
    position: 'absolute',
    top: '24%',
    right: '6%',
    fontSize: 14,
    fontWeight: 'bold',
    color: '#999',
    transform: [{ rotate: '20deg' }],
  },
});

export default AnimatedCharacter;
