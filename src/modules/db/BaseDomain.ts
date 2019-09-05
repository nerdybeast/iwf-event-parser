import { firestore } from 'firebase';

export abstract class BaseDomain {

	protected db: firestore.Firestore;
	protected collection: firestore.CollectionReference;

	constructor(db: firestore.Firestore, collectionName: string) {
		this.db = db;
		this.collection = this.db.collection(collectionName);
	}

	public get nativeCollection() {
		return this.collection;
	}

	public async getAllSnapshot() : Promise<firestore.QuerySnapshot> {
		const snapshot: firestore.QuerySnapshot = await this.collection.get();
		return snapshot;
	}
}