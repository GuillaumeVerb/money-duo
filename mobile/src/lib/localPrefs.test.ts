import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  getPreferredReminderHour,
  setPreferredReminderHour,
} from './localPrefs';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}));

describe('preferred reminder hour', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('defaults to 9 when unset', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
    await expect(getPreferredReminderHour()).resolves.toBe(9);
  });

  it('returns stored hour', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue('14');
    await expect(getPreferredReminderHour()).resolves.toBe(14);
  });

  it('clamps invalid stored values to default', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue('99');
    await expect(getPreferredReminderHour()).resolves.toBe(9);
  });

  it('persists hour via setPreferredReminderHour', async () => {
    await setPreferredReminderHour(21);
    expect(AsyncStorage.setItem).toHaveBeenCalled();
  });
});
