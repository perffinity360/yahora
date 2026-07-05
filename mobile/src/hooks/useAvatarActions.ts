import { useMutation, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '../contexts/AuthContext';
import { api } from '../lib/api';
import type { UserProfile } from '../types';

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
    await queryClient.invalidateQueries({ queryKey: ['dashboard', userId] });
    await queryClient.invalidateQueries({ queryKey: ['publicProfile', userId] });
  };

  const uploadAvatar = useMutation({
    mutationFn: (vars: { uri: string; mimeType?: string; fileName?: string }) => {
      const form = new FormData();
      // RN's fetch uploads a file descriptor object, not a Blob.
      form.append('avatar', {
        uri: vars.uri,
        name: vars.fileName ?? 'avatar.jpg',
        type: vars.mimeType ?? 'image/jpeg',
      } as unknown as Blob);
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
