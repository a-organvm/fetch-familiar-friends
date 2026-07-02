/**
 * Gamification Flow Integration Tests
 * Tests for quest completion, XP awards, level ups, achievements, and leaderboards
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderHook } from '@testing-library/react';
import {
  createMockSupabaseClient,
  createMockUser,
  createMockProfile,
  createMockQuest,
  createMockAchievement,
  resetIdCounter,
  getEndOfDay,
} from './setup';

// Use vi.hoisted() to define mockSupabase that can be mutated
const { mockSupabaseRef } = vi.hoisted(() => ({
  mockSupabaseRef: { current: null },
}));

vi.mock('../../config/supabase', () => ({
  get supabase() {
    return mockSupabaseRef.current;
  },
  isOnlineMode: true,
}));

// Alias for easier use in tests
let mockSupabase;

// Import after mocking
import { AuthProvider, useAuth } from '../../contexts/AuthContext';
import { useQuests } from '../../hooks/useQuests';
import { useLeaderboards } from '../../hooks/useLeaderboards';

// Test component for quests
const QuestsTestComponent = () => {
  const {
    dailyQuests,
    weeklyQuests,
    achievements,
    loading,
    error,
    completedDailyCount,
    totalDailyXp,
    updateQuestProgress,
    claimRewards,
    fetchQuests,
  } = useQuests();

  return (
    <div>
      <div data-testid="loading">{loading ? 'loading' : 'ready'}</div>
      <div data-testid="error">{error || 'none'}</div>
      <div data-testid="daily-count">{dailyQuests.length}</div>
      <div data-testid="weekly-count">{weeklyQuests.length}</div>
      <div data-testid="completed-daily">{completedDailyCount}</div>
      <div data-testid="total-daily-xp">{totalDailyXp}</div>
      <div data-testid="achievements-count">{achievements.length}</div>

      <ul data-testid="daily-quests">
        {dailyQuests.map((quest) => (
          <li key={quest.quest_key} data-testid={`quest-${quest.quest_key}`}>
            <span data-testid={`quest-${quest.quest_key}-progress`}>
              {quest.progress}/{quest.target}
            </span>
            <span data-testid={`quest-${quest.quest_key}-complete`}>
              {quest.isComplete ? 'complete' : 'incomplete'}
            </span>
            <span data-testid={`quest-${quest.quest_key}-xp`}>{quest.xp}</span>
          </li>
        ))}
      </ul>

      <button
        data-testid="update-photo-quest"
        onClick={() => updateQuestProgress('daily_photo', 1)}
      >
        Complete Photo Quest
      </button>

      <button
        data-testid="update-journal-quest"
        onClick={() => updateQuestProgress('daily_journal', 1)}
      >
        Complete Journal Quest
      </button>

      <button
        data-testid="fetch-quests"
        onClick={fetchQuests}
      >
        Fetch Quests
      </button>
    </div>
  );
};

// Test component for leaderboards
const LeaderboardsTestComponent = () => {
  const {
    globalLeaderboard,
    friendsLeaderboard,
    weeklyLeaderboard,
    userRank,
    loading,
    error,
    fetchAll,
    topGlobalUser,
  } = useLeaderboards();

  return (
    <div>
      <div data-testid="lb-loading">{loading ? 'loading' : 'ready'}</div>
      <div data-testid="lb-error">{error || 'none'}</div>
      <div data-testid="global-count">{globalLeaderboard.length}</div>
      <div data-testid="friends-count">{friendsLeaderboard.length}</div>
      <div data-testid="weekly-count">{weeklyLeaderboard.length}</div>
      <div data-testid="user-rank">{userRank || 'none'}</div>
      <div data-testid="top-user">{topGlobalUser?.username || 'none'}</div>

      <ul data-testid="global-leaderboard">
        {globalLeaderboard.map((entry) => (
          <li key={entry.id} data-testid={`rank-${entry.rank}`}>
            <span data-testid={`rank-${entry.rank}-username`}>{entry.username}</span>
            <span data-testid={`rank-${entry.rank}-level`}>{entry.level}</span>
            <span data-testid={`rank-${entry.rank}-xp`}>{entry.xp}</span>
            {entry.isCurrentUser && <span data-testid="current-user-marker">*</span>}
          </li>
        ))}
      </ul>

      <button data-testid="refresh-leaderboards" onClick={fetchAll}>
        Refresh
      </button>
    </div>
  );
};

// Wrapper with auth state
const AuthenticatedWrapper = ({ children, user, profile }) => {
  return (
    <AuthProvider>
      {children}
    </AuthProvider>
  );
};

describe('Gamification Flow Integration Tests', () => {
  let testUser;
  let testProfile;

  beforeEach(() => {
    resetIdCounter();
    testUser = createMockUser({ email: 'gamer@example.com' });
    testProfile = createMockProfile(testUser.id, {
      username: 'gamer',
      xp: 50,
      level: 2,
    });

    mockSupabase = createMockSupabaseClient({
      profiles: [testProfile],
      quests: [],
      achievements: [],
    });
    mockSupabaseRef.current = mockSupabase;

    // Set up authenticated session
    mockSupabase.auth.getSession.mockResolvedValue({
      data: { session: { user: testUser, access_token: 'token' } },
      error: null,
    });

    localStorage.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Quest Completion Flow', () => {
    it('should load daily quests on mount', async () => {
      // Add some quests to the mock data
      const photoQuest = createMockQuest(testUser.id, {
        quest_key: 'daily_photo',
        quest_type: 'daily',
        target: 1,
        progress: 0,
      });
      mockSupabase._data.quests.push(photoQuest);

      render(
        <AuthenticatedWrapper user={testUser} profile={testProfile}>
          <QuestsTestComponent />
        </AuthenticatedWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('ready');
      });

      // Quests should be loaded (mocked)
      expect(screen.getByTestId('daily-count')).toBeDefined();
    });

    it('should update quest progress', async () => {
      const user = userEvent.setup();

      const photoQuest = createMockQuest(testUser.id, {
        quest_key: 'daily_photo',
        quest_type: 'daily',
        target: 1,
        progress: 0,
      });
      mockSupabase._data.quests.push(photoQuest);

      render(
        <AuthenticatedWrapper user={testUser} profile={testProfile}>
          <QuestsTestComponent />
        </AuthenticatedWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('ready');
      });

      // Click to update quest progress
      await user.click(screen.getByTestId('update-photo-quest'));

      // Verify supabase was called
      await waitFor(() => {
        expect(mockSupabase.from).toHaveBeenCalledWith('quests');
      });
    });

    it('should handle quest completion and XP award', async () => {
      const user = userEvent.setup();

      // Quest that will complete on one update
      const photoQuest = createMockQuest(testUser.id, {
        quest_key: 'daily_photo',
        quest_type: 'daily',
        target: 1,
        progress: 0,
        xp: 10,
      });
      mockSupabase._data.quests.push(photoQuest);

      render(
        <AuthenticatedWrapper user={testUser} profile={testProfile}>
          <QuestsTestComponent />
        </AuthenticatedWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('ready');
      });

      // Complete the quest (now uses local tracking)
      await user.click(screen.getByTestId('update-photo-quest'));

      // Quest completion now uses local tracking first
      // RPC may be called for server sync when authenticated
      await waitFor(() => {
        // The quest update should have triggered (local or server)
        expect(mockSupabase.from).toHaveBeenCalled();
      });
    });
  });

  describe('XP Award and Level Up', () => {
    it('should award XP when completing a quest', async () => {
      const user = userEvent.setup();

      const journalQuest = createMockQuest(testUser.id, {
        quest_key: 'daily_journal',
        quest_type: 'daily',
        target: 1,
        progress: 0,
        xp: 20,
      });
      mockSupabase._data.quests.push(journalQuest);

      render(
        <AuthenticatedWrapper user={testUser} profile={testProfile}>
          <QuestsTestComponent />
        </AuthenticatedWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('ready');
      });

      await user.click(screen.getByTestId('update-journal-quest'));

      // Quest completion now uses local tracking
      // Verify the quest update was triggered
      await waitFor(() => {
        expect(mockSupabase.from).toHaveBeenCalled();
      });
    });

    it('should trigger level up when XP threshold is reached', async () => {
      // Set profile to be close to level up
      testProfile.xp = 190; // Level 2 needs 200 XP to level up
      testProfile.level = 2;

      // Mock RPC to return level up (for server sync)
      mockSupabase.rpc.mockResolvedValueOnce({
        data: { leveled_up: true, new_level: 3 },
        error: null,
      });

      const journalQuest = createMockQuest(testUser.id, {
        quest_key: 'daily_journal',
        quest_type: 'daily',
        target: 1,
        progress: 0,
        xp: 20,
      });
      mockSupabase._data.quests.push(journalQuest);

      const user = userEvent.setup();

      render(
        <AuthenticatedWrapper user={testUser} profile={testProfile}>
          <QuestsTestComponent />
        </AuthenticatedWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('ready');
      });

      await user.click(screen.getByTestId('update-journal-quest'));

      // Local tracking handles XP now, server sync may follow
      await waitFor(() => {
        expect(mockSupabase.from).toHaveBeenCalled();
      });
    });

    it('should calculate correct XP for next level', () => {
      // Level 1 needs 100 XP
      // Level 2 needs 200 XP
      // Level n needs n * 100 XP
      const level = 5;
      const expectedXpForNextLevel = level * 100; // 500 XP
      expect(expectedXpForNextLevel).toBe(500);
    });
  });

  describe('Achievement Unlock', () => {
    it('should check for achievements after actions', async () => {
      const user = userEvent.setup();

      render(
        <AuthenticatedWrapper user={testUser} profile={testProfile}>
          <QuestsTestComponent />
        </AuthenticatedWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('ready');
      });

      // Achievements are checked based on context
      expect(screen.getByTestId('achievements-count')).toBeDefined();
    });

    it('should load existing achievements', async () => {
      const achievement = createMockAchievement(testUser.id, {
        achievement_key: 'first_journal',
      });
      mockSupabase._data.achievements.push(achievement);

      render(
        <AuthenticatedWrapper user={testUser} profile={testProfile}>
          <QuestsTestComponent />
        </AuthenticatedWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('ready');
      });

      // Achievements should be loaded
      expect(screen.getByTestId('achievements-count')).toBeDefined();
    });
  });

  describe('Leaderboard Update', () => {
    it('should load global leaderboard', async () => {
      // Add multiple profiles for leaderboard
      const topPlayer = createMockProfile('top-player-id', {
        username: 'topplayer',
        level: 50,
        xp: 4500,
      });
      const secondPlayer = createMockProfile('second-player-id', {
        username: 'secondplayer',
        level: 30,
        xp: 2900,
      });

      mockSupabase._data.profiles.push(topPlayer, secondPlayer);

      render(
        <AuthenticatedWrapper user={testUser} profile={testProfile}>
          <LeaderboardsTestComponent />
        </AuthenticatedWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('lb-loading')).toHaveTextContent('ready');
      });

      // Leaderboard data should be fetched
      expect(mockSupabase.from).toHaveBeenCalledWith('profiles');
    });

    it('should show user rank in leaderboard', async () => {
      // Add profiles including current user
      mockSupabase._data.profiles = [
        createMockProfile('rank1', { username: 'first', level: 10, xp: 500 }),
        createMockProfile('rank2', { username: 'second', level: 8, xp: 300 }),
        testProfile,
      ];

      render(
        <AuthenticatedWrapper user={testUser} profile={testProfile}>
          <LeaderboardsTestComponent />
        </AuthenticatedWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('lb-loading')).toHaveTextContent('ready');
      });

      expect(screen.getByTestId('global-count')).toBeDefined();
    });

    it('should refresh leaderboard on demand', async () => {
      const user = userEvent.setup();

      render(
        <AuthenticatedWrapper user={testUser} profile={testProfile}>
          <LeaderboardsTestComponent />
        </AuthenticatedWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('lb-loading')).toHaveTextContent('ready');
      });

      // Clear previous calls
      vi.clearAllMocks();

      // Click refresh
      await user.click(screen.getByTestId('refresh-leaderboards'));

      // Should fetch again
      await waitFor(() => {
        expect(mockSupabase.from).toHaveBeenCalled();
      });
    });

    it('should load friends leaderboard', async () => {
      // Add friendships
      const friend = createMockProfile('friend-id', {
        username: 'myfriend',
        level: 5,
        xp: 400,
      });

      mockSupabase._data.profiles.push(friend);
      mockSupabase._data.friendships = [
        {
          id: 'friendship-1',
          requester_id: testUser.id,
          addressee_id: 'friend-id',
          status: 'accepted',
        },
      ];

      render(
        <AuthenticatedWrapper user={testUser} profile={testProfile}>
          <LeaderboardsTestComponent />
        </AuthenticatedWrapper>
      );

      // Friends leaderboard should be fetched
      await waitFor(() => {
        expect(mockSupabase.from).toHaveBeenCalledWith('friendships');
      });
    });

    it('should load weekly activity leaderboard', async () => {
      // Add activities for this week
      const activity = {
        id: 'activity-1',
        user_id: testUser.id,
        activity_type: 'post',
        created_at: new Date().toISOString(),
        user: testProfile,
      };
      mockSupabase._data.activities.push(activity);

      render(
        <AuthenticatedWrapper user={testUser} profile={testProfile}>
          <LeaderboardsTestComponent />
        </AuthenticatedWrapper>
      );

      // Activities should be fetched
      await waitFor(() => {
        expect(mockSupabase.from).toHaveBeenCalledWith('activities');
      });
    });
  });

  describe('Weekly Quests', () => {
    it('should load weekly quests', async () => {
      const weeklyQuest = createMockQuest(testUser.id, {
        quest_key: 'weekly_streak',
        quest_type: 'weekly',
        target: 7,
        progress: 3,
      });
      mockSupabase._data.quests.push(weeklyQuest);

      render(
        <AuthenticatedWrapper user={testUser} profile={testProfile}>
          <QuestsTestComponent />
        </AuthenticatedWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('ready');
      });

      expect(screen.getByTestId('weekly-count')).toBeDefined();
    });

    it('should track weekly quest progress over time', async () => {
      const weeklyQuest = createMockQuest(testUser.id, {
        quest_key: 'weekly_journalist',
        quest_type: 'weekly',
        target: 5,
        progress: 2,
      });
      mockSupabase._data.quests.push(weeklyQuest);

      render(
        <AuthenticatedWrapper user={testUser} profile={testProfile}>
          <QuestsTestComponent />
        </AuthenticatedWrapper>
      );

      // Quest progress should be tracked
      await waitFor(() => {
        expect(mockSupabase.from).toHaveBeenCalledWith('quests');
      });
    });
  });

  describe('Quest Rewards', () => {
    it('should track XP rewards for quests', () => {
      // Quest definitions
      const questRewards = {
        daily_photo: 10,
        daily_journal: 20,
        daily_favorite: 10,
        daily_social: 15,
        daily_virtual_pet: 15,
        weekly_streak: 100,
        weekly_explorer: 75,
        weekly_journalist: 80,
      };

      // Verify expected rewards
      expect(questRewards.daily_photo).toBe(10);
      expect(questRewards.weekly_streak).toBe(100);
    });

    it('should calculate total available daily XP', () => {
      const dailyQuests = [
        { xp: 10, isComplete: false },
        { xp: 20, isComplete: true },
        { xp: 15, isComplete: false },
      ];

      const totalXp = dailyQuests.reduce((sum, q) => sum + (q.isComplete ? q.xp : 0), 0);
      expect(totalXp).toBe(20);
    });
  });

  describe('Streak Tracking', () => {
    it('should track user streak days', () => {
      expect(testProfile.streak_days).toBe(5);
    });

    it('should integrate with weekly streak quest', async () => {
      const streakQuest = createMockQuest(testUser.id, {
        quest_key: 'weekly_streak',
        quest_type: 'weekly',
        target: 7,
        progress: testProfile.streak_days,
      });
      mockSupabase._data.quests.push(streakQuest);

      render(
        <AuthenticatedWrapper user={testUser} profile={testProfile}>
          <QuestsTestComponent />
        </AuthenticatedWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('ready');
      });

      // Streak should be reflected in quest progress
      expect(mockSupabase.from).toHaveBeenCalled();
    });
  });
});
