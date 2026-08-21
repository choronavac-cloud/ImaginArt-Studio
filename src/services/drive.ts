
import { getAccessToken } from './auth';

export async function saveToDrive(fileBlob: Blob, fileName: string, folderName?: string): Promise<any> {
    const accessToken = await getAccessToken();
    if (!accessToken) {
        throw new Error("No access token available. Please sign in.");
    }

    // Convert blob to base64
    const reader = new FileReader();
    const base64Promise = new Promise<string>((resolve) => {
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(fileBlob);
    });
    const base64Data = await base64Promise;

    const response = await fetch('/api/drive/upload', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            name: fileName,
            data: base64Data.split(',')[1], // Get base64 string
            folderName: folderName
        })
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save to Drive');
    }

    return response.json();
}

export async function listDriveFiles(): Promise<any[]> {
    const accessToken = await getAccessToken();
    if (!accessToken) {
        throw new Error("No access token available. Please sign in.");
    }

    const response = await fetch('/api/drive/files', {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${accessToken}`
        }
    });

    if (!response.ok) {
        throw new Error('Failed to list Drive files');
    }

    return response.json();
}

export async function listDriveFolders(): Promise<any[]> {
    const accessToken = await getAccessToken();
    if (!accessToken) {
        throw new Error("No access token available. Please sign in.");
    }

    const response = await fetch('/api/drive/folders', {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${accessToken}`
        }
    });

    if (!response.ok) {
        throw new Error('Failed to list Drive folders');
    }

    return response.json();
}

export async function getDriveQuota(): Promise<any> {
    const accessToken = await getAccessToken();
    if (!accessToken) {
        throw new Error("No access token available. Please sign in.");
    }

    const response = await fetch("https://www.googleapis.com/drive/v3/about?fields=storageQuota", {
        method: "GET",
        headers: {
            'Authorization': `Bearer ${accessToken}`
        }
    });

    if (!response.ok) {
        throw new Error('Failed to fetch Drive quota');
    }

    return response.json();
}

export async function createDriveFolder(folderName: string, parentId?: string): Promise<any> {
    const accessToken = await getAccessToken();
    if (!accessToken) {
        throw new Error("No access token available. Please sign in.");
    }

    const response = await fetch('/api/drive/folders/create', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ folderName, parentId })
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create folder');
    }

    return response.json();
}

export async function downloadDriveFile(fileId: string): Promise<{ data: string }> {
    const accessToken = await getAccessToken();
    if (!accessToken) {
        throw new Error("No access token available. Please sign in.");
    }

    const response = await fetch(`/api/drive/files/download/${fileId}`, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${accessToken}`
        }
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to download file');
    }

    return response.json();
}

export async function deleteDriveFile(fileId: string): Promise<{ success: boolean }> {
    const accessToken = await getAccessToken();
    if (!accessToken) {
        throw new Error("No access token available. Please sign in.");
    }

    const response = await fetch(`/api/drive/files/${fileId}`, {
        method: 'DELETE',
        headers: {
            'Authorization': `Bearer ${accessToken}`
        }
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete file');
    }

    return response.json();
}
