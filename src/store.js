import Vue from "vue";
import Vuex from "vuex";
import { childrenCollection, speechSessionsCollection } from "./firebase"

Vue.use(Vuex);

const syntaxColors = { 'VERB': 'red' , 'ADV': 'orange', 'ADP': 'orange', 'PRON': '#1DCAE84D', 'NOUN': '#1D62F0', 'ADJ': 'green', 'DEFAULT': '#1D62F0' };

const annotationNlpMapper = (annotation, nlp) => {

  const tagMap = new Map();
  const tagCounts = {};

  if (nlp && nlp.syntax.tokens) {
    nlp.syntax.tokens.forEach(item => {
         const key = item.partOfSpeech.tag
         const collection = tagMap.get(key);
         if (!collection) {
             tagMap.set(key, [item]);
         } else {
             collection.push(item);
         }
    });
    for (const [key, value] of tagMap.entries()) {
      if(tagCounts[key]) tagCounts[key] = tagCounts[key] + value.length;
      else tagCounts[key] = value.length;    
    }
  }

  return Object.assign({}, annotation, {
      syntaxValues: nlp ? nlp.syntax.tokens.map((token, index) => {
            let skipAhead = token.dependencyEdge.headTokenIndex - index;
            return {
              val: 20,
              color: syntaxColors[token.partOfSpeech.tag] || syntaxColors['DEFAULT'],
              person: (token.partOfSpeech.person.indexOf('UNKNOWN') > -1) ? ' ' : token.partOfSpeech.person.toLowerCase() + ' p.',
              label: token.lemma, skip: skipAhead,
              tag: token.partOfSpeech.tag,
              edgeLabel: token.dependencyEdge.label
            }
      }) : null,
      sentiment: (nlp && nlp.sentiment) ? nlp.sentiment.score : null,
      tagCounts: tagCounts
  })
}

speechSessionsCollection.orderBy('createdOn', 'desc').onSnapshot(snapshot => {
 	Promise.all(snapshot.docs.map(doc => {
    	let session = doc.data()
   		session.id = doc.id
      return speechSessionsCollection.doc(doc.id).collection('annotations').get().then(annotationSnapshot => {
              var annotations = {}
              var adultSpeechDuration = 0
              var childSpeechDuration = 0
              var adultNoOfTurns = 0
              var childNoOfTurns = 0
              var adultTranscriptWords = 0
              var childTranscriptWords = 0
              var tagTotals = {};

              annotationSnapshot.forEach(annotationDoc => {
                  let annotationData = annotationNlpMapper(annotationDoc.data(), annotationDoc.data().nlp);
                  if ((annotationData.speaker == 'child') && annotationData.duration) {
                    childSpeechDuration += annotationData.duration
                    childTranscriptWords += annotationData.transcript.length
                    childNoOfTurns++
                  }
                  if ((annotationData.speaker == 'adult') && annotationData.duration) {
                    adultSpeechDuration += annotationData.duration;
                    adultTranscriptWords += annotationData.transcript.length
                    adultNoOfTurns++
                  }
                  if (annotationData.tagCounts) {
                    for (let [key, value] of Object.entries(annotationData.tagCounts)) { 
                        if (tagTotals[key]) { //(4)
                          tagTotals[key] += value; //(5)
                        } else { //(6)
                          tagTotals[key] = value;
                        }
                    }
                  }
                  annotations[annotationData.annotationId] = annotationData
              });

              session.adultSpeechDuration = adultSpeechDuration
              session.adultNoOfTurns = adultNoOfTurns
              session.adultTranscriptWords = adultTranscriptWords
              session.childSpeechDuration = childSpeechDuration
              session.childNoOfTurns = childNoOfTurns
              session.childTranscriptWords = childTranscriptWords
              session.tagTotals = tagTotals
              session.totalSpeechDuration = adultSpeechDuration + childSpeechDuration
              session.totalNoOfTurns = adultNoOfTurns + childNoOfTurns
              session.totalTranscriptWords = adultTranscriptWords + childTranscriptWords
              session.annotations = annotations
              return session;
      })
  	})).then(sessions => {
      childrenCollection.onSnapshot(snapshot => {
        Promise.all(snapshot.docs.map(doc => {
            let child = doc.data()
            child.quotes = []
            return child
          })).then(children => {
            sessions = sessions.map(session=>{
                session.child = children.filter(child=>{
                  return child.id == session.childId;
                })[0];
                return session;
            }).filter(session=>{
                return !session.deleted;
            })
            store.commit('setSpeechSessions', sessions)
          });
      })
    })
})

childrenCollection.onSnapshot(snapshot => {
  Promise.all(snapshot.docs.map(doc => {
      let child = doc.data()
      child.quotes = []
      return child
    })).then(children => {
        store.commit('setChildren', children)
    });
})

const store = new Vuex.Store({
  state: {
    children: [],
    user: {
      loggedIn: false,
      data: null
    },
    speechSession: null,
    speechSessions: []
  },
  getters: {
    user(state){
      return state.user
    }
  },
  mutations: {
    setChildren(state, value) {
      state.children = value;
    },
  	setSpeechSessions(state, value) {
  		state.speechSessions = [value[0]];
  	},
    setSpeechSession(state, value) {
      state.speechSession = value;
    },
    setChildQuotes(state, value) {
        state.children = state.children.map(child=>{
            if(value) child.quotes.push(value)
            
            return child
        })
    },
    setAnnotation(state, value) {
        state.speechSessions = state.speechSessions.map(session=>{
            if (session.sessionId == value.sessionId) {
                let annotations = session.annotations || {}
                annotations[value.annotation.annotationId] = value.annotation
                session.annotations = annotations
            }
            return session
        })

        // state.children = state.children.map(child=>{
        //     child.quotes.push(value.annotation.transcript)
        //     return child
        // })
    },
    SET_LOGGED_IN(state, value) {
      state.user.loggedIn = value;
    },
    SET_USER(state, data) {
      state.user.data = data;
    }
  },
  actions: {
  	async createSpeechSession({state, commit}) {
      const ref = speechSessionsCollection.doc();
      const id = ref.id;
      const session = {
        sessionId: id,
        comments: "",
        createdOn: new Date()
      };
  		await speechSessionsCollection.add(session).then(()=> {
        return store.commit('setSpeechSession', session)
      })
  	},
    async updateChild({state, commit}, child) {
      await childrenCollection
              .where("id", "==", child.id)
              .get()
              .then(docs => {
                  docs.forEach(doc => {
                    doc.ref.update(child)
                  })
              })
    },
    async updateSession({state, commit}, data) {
         await speechSessionsCollection
                .where("sessionId", "==", data.sessionId)
                .get()
                .then(docs => {
                    docs.forEach(doc => {
                        doc.ref.update(data).then(()=>{
                            store.commit('setSpeechSession', data);
                        })
                    })
                })
    },
    async updateAnnotation({state, commit}, data) {
      await speechSessionsCollection
              .where("sessionId", "==", data.sessionId)
              .get()
              .then(docs => {
                docs.forEach(doc => {
                  var annotationsCollections = speechSessionsCollection.doc(doc.id).collection('annotations');
                  annotationsCollections.where("annotationId", "==", data.annotation.annotationId).get().then((annotationDocs) => {
                      if (annotationDocs.empty) { // Create a new annotation
                        annotationsCollections.add(data.annotation).then(()=>store.commit('setAnnotation', data))
                      }
                      else {
                        annotationDocs.forEach(annotationDoc=> { // Update an annotation
                            let updatedAnnotation = data.annotation;
                            annotationDoc.ref.update(updatedAnnotation).then(()=> {
                              data.annotation = annotationNlpMapper(updatedAnnotation, updatedAnnotation.nlp);
                              store.commit('setAnnotation', data);
                              if (updatedAnnotation.starred) store.commit('setChildQuotes', updatedAnnotation.transcript);
                            });
                        })
                      }
                  })
                })
              })
    },
    fetchUser({ commit }, user) {
      commit("SET_LOGGED_IN", user !== null);
      if (user) {
        commit("SET_USER", {
          displayName: user.displayName,
          email: user.email
        });
      } else {
        commit("SET_USER", null);
      }
    },
  }
});

export default store