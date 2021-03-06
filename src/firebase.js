import * as firebase from 'firebase/app'
import 'firebase/firestore'
import store from "./store"

// Firebase Config
const firebaseConfig = {
    apiKey: "AIzaSyDnR_JLW2aE1lhpF9SJZJiiCNz-HqA5_N4",
    authDomain: "ispeech-brendan.firebaseapp.com",
    databaseURL: "https://ispeech-brendan.firebaseio.com",
    projectId: "ispeech-brendan",
    storageBucket: "ispeech-brendan.appspot.com",
    messagingSenderId: "849833613553",
    appId: "1:849833613553:web:3c0e20b5b9fb744f987150",
    measurementId: "G-0FZMHE3JSG"
};

// Initalize Firebase
firebase.initializeApp(firebaseConfig);
// Firestore collections
const db = firebase.firestore();
const childrenCollection = db.collection('children')
const speechSessionsCollection = db.collection('speech_sessions')
const teachersCollection = db.collection('teachers')
const usersCollection = db.collection('users');
const annotationsCollection = db.collectionGroup('annotations')
const countsCollection = db.collectionGroup('counts')
const childFeaturesCollection = db.collectionGroup('child_features')
const teacherFeaturesCollection = db.collectionGroup('teacher_features')

// Firebase auth
let currentUser;
const auth = firebase.auth().onAuthStateChanged(user => {  
    currentUser = firebase.auth().currentUser;
    store.dispatch("fetchUser", user);
});

export {
	auth,
	db,
    currentUser,
    annotationsCollection,
    childFeaturesCollection,
    childrenCollection,
    countsCollection,
	speechSessionsCollection,
    teachersCollection,
    teacherFeaturesCollection,
    usersCollection
}