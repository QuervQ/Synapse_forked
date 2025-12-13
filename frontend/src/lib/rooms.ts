import { supabase } from './supabase';

export interface Room {
    id: string;
    name: string;
    created_by: string;
    created_at: string;
}

export interface Participant {
    id: string;
    room_id: string;
    user_id: string;
    user_name: string;
    role: string;
    joined_at: string;
}

/**
 * ルームを作成または取得する
 */
export const createOrGetRoom = async (roomId: string, userId: string) => {
    try {
        // まず既存のルームを検索
        const { data: existingRoom, error: fetchError } = await supabase
            .from('rooms')
            .select('*')
            .eq('id', roomId)
            .maybeSingle();

        if (fetchError && fetchError.code !== 'PGRST116') {
            // PGRST116は「レコードが見つからない」エラーなので無視
            console.error('Error fetching room:', fetchError);
            return { data: null, error: fetchError };
        }

        // 既存のルームがあればそれを返す
        if (existingRoom) {
            return { data: existingRoom, error: null };
        }

        // 新しいルームを作成
        const { data: newRoom, error: createError } = await supabase
            .from('rooms')
            .insert([
                {
                    id: roomId,
                    name: roomId,
                    created_by: userId
                }
            ])
            .select()
            .single();

        if (createError) {
            console.error('Error creating room:', createError);
            return { data: null, error: createError };
        }

        return { data: newRoom, error: null };
    } catch (error) {
        console.error('Unexpected error in createOrGetRoom:', error);
        return { data: null, error };
    }
};

/**
 * ルームに参加する
 */
export const joinRoom = async (roomId: string, userId: string, userName: string) => {
    try {
        // 既に参加しているか確認
        const { data: existingParticipant, error: checkError } = await supabase
            .from('participants')
            .select('*')
            .eq('room_id', roomId)
            .eq('user_id', userId)
            .maybeSingle();

        if (checkError && checkError.code !== 'PGRST116') {
            console.error('Error checking participant:', checkError);
            return { error: checkError };
        }

        // 既に参加していればスキップ
        if (existingParticipant) {
            return { error: null };
        }

        // 新規参加
        const { error: insertError } = await supabase
            .from('participants')
            .insert([
                {
                    room_id: roomId,
                    user_id: userId,
                    user_name: userName,
                    role: 'member'
                }
            ]);

        if (insertError) {
            console.error('Error joining room:', insertError);
            return { error: insertError };
        }

        return { error: null };
    } catch (error) {
        console.error('Unexpected error in joinRoom:', error);
        return { error };
    }
};

/**
 * ルームから退出する
 */
export const leaveRoom = async (roomId: string, userId: string) => {
    try {
        const { error } = await supabase
            .from('participants')
            .delete()
            .eq('room_id', roomId)
            .eq('user_id', userId);

        if (error) {
            console.error('Error leaving room:', error);
            return { error };
        }

        return { error: null };
    } catch (error) {
        console.error('Unexpected error in leaveRoom:', error);
        return { error };
    }
};

/**
 * ルーム一覧を取得する
 */
export const getRooms = async (limit: number = 10) => {
    try {
        const { data, error } = await supabase
            .from('rooms')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(limit);

        if (error) {
            console.error('Error fetching rooms:', error);
            return { data: null, error };
        }

        return { data, error: null };
    } catch (error) {
        console.error('Unexpected error in getRooms:', error);
        return { data: null, error };
    }
};

/**
 * ルームの参加者を取得する
 */
export const getRoomParticipants = async (roomId: string) => {
    try {
        const { data, error } = await supabase
            .from('participants')
            .select('*')
            .eq('room_id', roomId);

        if (error) {
            console.error('Error fetching participants:', error);
            return { data: null, error };
        }

        return { data, error: null };
    } catch (error) {
        console.error('Unexpected error in getRoomParticipants:', error);
        return { data: null, error };
    }
};