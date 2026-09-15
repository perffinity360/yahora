import { useMutation, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '../contexts/AuthContext';
import { api } from '../lib/api';
import { toUploadFile } from '../lib/upload';
import type { DashboardData, PublicProfileData, UserProfile } from '../types';

interface AvatarUploadResponse {
  message: string;
  avatar_url: string;
}

interface ProfileUpdateResponse {
  message: string;
  userProfile: UserProfile;
}

/**
 * Change / remove the profile photo. Upload goes through the backend's
 * multipart endpoint (which also deletes the old file from storage); removal
 * is a plain profile PUT. Both sync the AuthContext profile and refresh the
 * dashboard payload so every screen shows the new photo immediately.
 */
export function useAvatarActions(userId: string | null | undefined) {
  const queryClient = useQueryClient();
  const { profile, saveProfile } = useAuth();

  const syncAvatar = async (avatarUrl: string | null) => {
    if (profile) await saveProfile({ ...profile, avatar_url: avatarUrl });

    // Write the new URL straight into the cached payloads first.
    //
    // The dashboard renders `useDashboard().data.profile.avatar_url`, NOT the
    // AuthContext profile — so until that query's data changes, the header
    // keeps drawing the old photo no matter what the mutation returned. Waiting
    // on the invalidation below leaves the old photo on screen for a whole
    // round trip, and if that refetch is slow, fails, or the screen is offline,
    // it never lands at all and the upload looks like it did nothing.
    //
    // The backend already told us the new URL, so there is nothing to wait for.
    // Patch both cached payloads, then revalidate.
    queryClient.setQueryData<DashboardData>(['dashboard', userId], (prev) =>
      prev ? { ...prev, profile: { ...prev.profile, avatar_url: avatarUrl } } : prev,
    );
    queryClient.setQueryData<PublicProfileData>(['publicProfile', userId], (prev) =>
      prev ? { ...prev, profile: { ...prev.profile, avatar_url: avatarUrl } } : prev,
    );

    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['dashboard', userId] }),
      queryClient.invalidateQueries({ queryKey: ['publicProfile', userId] }),
    ]);
  };

  const uploadAvatar = useMutation({
    mutationFn: (vars: { uri: string; mimeType?: string; fileName?: string }) => {
      const form = new FormData();
      form.append(
        'avatar',
        toUploadFile({ uri: vars.uri, name: vars.fileName ?? 'avatar.jpg', type: vars.mimeType }),
      );
      return api.uploadForm<AvatarUploadResponse>(`/api/user/${userId}/avatar`, form);
    },
    onSuccess: (data) => syncAvatar(data.avatar_url),
  });

  const removeAvatar = useMutation({
    mutationFn: () =>
      api.put<ProfileUpdateResponse>(`/api/user/${userId}/profile`, { avatar_url: null }),
    onSuccess: () => syncAvatar(null),
  });

  return { uploadAvatar, removeAvatar };
}
