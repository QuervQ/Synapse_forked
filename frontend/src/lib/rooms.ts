import { supabase } from './supabase';

export interface Room {
    id: string;
    room_name: string;
    is_private: boolean;
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

export const createOrGetRoom = async (roomName: string, userId: string, isPrivate: boolean = false) => {
    try {
        const { data: existingRoom, error: fetchError } = await supabase
            .from('rooms')
            .select('*')
            .eq('room_name', roomName)
            .maybeSingle();

        if (fetchError && fetchError.code !== 'PGRST116') {
            console.error('Error fetching room:', fetchError);
            return { data: null, error: fetchError };
        }

        if (existingRoom) {
            return { data: existingRoom, error: null };
        }

        const { data: newRoom, error: createError } = await supabase
            .from('rooms')
            .insert([
                {
                    room_name: roomName,
                    created_by: userId,
                    is_private: isPrivate
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

export const joinRoom = async (roomId: string, userId: string, userName: string) => {
    try {
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

        if (existingParticipant) {
            return { error: null };
        }

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

export const getRooms = async (limit: number = 10) => {
    try {
        const { data, error } = await supabase
            .from('rooms')
            .select('*')
            .eq('is_private', false)
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