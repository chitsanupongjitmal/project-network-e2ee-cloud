
import { useState, useEffect, useRef } from 'react';
import { decryptMessage } from '../../utils/keyManager';

export const useChatEncryption = (messages, keyPair, peerPublicKey, peerUser) => {
    const [decryptedMessages, setDecryptedMessages] = useState([]);
    const decryptCacheRef = useRef(new Map());

    useEffect(() => {
        if (!keyPair?.privateKey || !peerPublicKey || !peerUser) {
            setDecryptedMessages(messages);
            return;
        }

        const decryptAll = async () => {
            const processedMessages = await Promise.all(
                messages.map(async (msg) => {
                    if (msg.isTemp || msg.is_unsent) {
                        return msg;
                    }

                    let decryptedTextContent = '';
                    let fileInfo = null;
                    let error = null;
                    const cacheKey = `${msg.id}:${msg.type || ''}:${msg.text || ''}`;
                    const cachedValue = decryptCacheRef.current.get(cacheKey);

                    if (cachedValue) {
                        decryptedTextContent = cachedValue.decryptedText;
                        fileInfo = cachedValue.fileInfo;
                    } else if (msg.type?.startsWith('encrypted') && msg.text) {
                        try {
                            const decryptedPayload = await decryptMessage(msg.text, peerPublicKey, keyPair.privateKey);
                            if (msg.type === 'encrypted_image' || msg.type === 'encrypted_file') {
                                fileInfo = JSON.parse(decryptedPayload);
                                decryptedTextContent = fileInfo.caption || '';
                            } else {
                                decryptedTextContent = decryptedPayload;
                            }
                            decryptCacheRef.current.set(cacheKey, {
                                decryptedText: decryptedTextContent,
                                fileInfo
                            });
                        } catch (e) {
                            error = "🔒 Could not decrypt message.";
                        }
                    } else {
                        decryptedTextContent = msg.text;
                    }


                    let processedRepliedTo = null;
                    if (msg.repliedTo && msg.repliedTo.text) {
                        let decryptedRepliedText = "🔒 Encrypted message";
                        let repliedFileInfo = null;

                        try {
                            const decryptedRepliedPayload = await decryptMessage(msg.repliedTo.text, peerPublicKey, keyPair.privateKey);
                            if (msg.repliedTo.type?.startsWith('encrypted_image') || msg.repliedTo.type?.startsWith('encrypted_file')) {
                                repliedFileInfo = JSON.parse(decryptedRepliedPayload);
                                decryptedRepliedText = repliedFileInfo.caption || (msg.repliedTo.type.includes('image') ? 'Photo' : 'File');
                            } else {
                                decryptedRepliedText = decryptedRepliedPayload;
                            }
                        } catch (err) {

                        }
                        
                        processedRepliedTo = {
                            ...msg.repliedTo,
                            text: decryptedRepliedText,
                            fileInfo: repliedFileInfo,
                        };
                    }


                    return {
                        ...msg,
                        decryptedText: decryptedTextContent,
                        fileInfo: fileInfo,
                        error: error,
                        repliedTo: processedRepliedTo,
                    };
                })
            );
            setDecryptedMessages(processedMessages);
        };

        decryptAll();
    }, [messages, keyPair, peerPublicKey, peerUser]);

    return decryptedMessages;
};
