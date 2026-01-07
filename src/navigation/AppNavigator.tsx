import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { RootStackParamList } from './types';
import PermissionScreen from '../screens/PermissionScreen';
import FocusTimerScreen from '../screens/FocusTimerScreen';
import CharacterScreen from '../screens/CharacterScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

const AppNavigator: React.FC = () => {
  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName="Permission"
        screenOptions={{
          headerStyle: {
            backgroundColor: '#2196f3',
          },
          headerTintColor: '#fff',
          headerTitleStyle: {
            fontWeight: 'bold',
          },
        }}
      >
        <Stack.Screen
          name="Permission"
          component={PermissionScreen}
          options={{
            title: '권한 설정',
            headerShown: true,
          }}
        />
        <Stack.Screen
          name="FocusTimer"
          component={FocusTimerScreen}
          options={{
            title: '집중 타이머',
            headerShown: true,
          }}
        />
        <Stack.Screen
          name="Character"
          component={CharacterScreen}
          options={{
            title: '캐릭터 육성',
            headerShown: true,
          }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default AppNavigator;
