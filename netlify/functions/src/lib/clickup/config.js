import { collection, addDoc, updateDoc, deleteDoc, doc, getDocs, query, where, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';
export class ClickUpConfigManager {
    constructor() {
        this.collectionRef = collection(db, 'clickup_configs');
    }
    async getConfig(userId) {
        const q = query(this.collectionRef, where('userId', '==', userId));
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
            const configDoc = snapshot.docs[0];
            return {
                id: configDoc.id,
                ...configDoc.data(),
                createdAt: configDoc.data().createdAt.toDate(),
                updatedAt: configDoc.data().updatedAt.toDate()
            };
        }
        return null;
    }
    async saveConfig(data) {
        const now = Timestamp.now();
        const docRef = await addDoc(this.collectionRef, {
            ...data,
            createdAt: now,
            updatedAt: now
        });
        return {
            ...data,
            id: docRef.id,
            createdAt: now.toDate(),
            updatedAt: now.toDate()
        };
    }
    async updateConfig(id, data) {
        const configRef = doc(this.collectionRef, id);
        await updateDoc(configRef, {
            ...data,
            updatedAt: Timestamp.now()
        });
    }
    async deleteConfig(id) {
        await deleteDoc(doc(this.collectionRef, id));
    }
}
