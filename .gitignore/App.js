import React, { Component } from 'react';
import firebase from '@firebase/app';
import firestore from './firestore'; // Code: https://gist.github.com/sconstantinides/546a48ba183b1234f750ca6261440199

class App extends Component {
  constructor(props) {
    super(props);

    this.state = {
      userId: localStorage.getItem('userId') || '',
      tasks: JSON.parse(localStorage.getItem('tasks')) || {}
    };
    
    firestore.then(db => this.db = db);
  }

  handleSignIn = (user) => {
    localStorage.clear();
    localStorage.setItem('userId', user.uid);
    this.setState({
      userId: user.uid
    });
    
    this.getTasks(user.uid);
  };

  handleSignOut = () => {
    if (this.unsubscribe) this.unsubscribe();

    localStorage.clear();
    this.setState({
      userId: '',
      tasks: {}
    });
  };

  getTasks = (userId, attempt = 1) => {
    if (!this.db) return setTimeout(() => this.getTasks(userId, attempt + 1), 1000 * attempt);

    this.unsubscribe = this.db.collection(`users/${userId}/tasks`)
      .orderBy('created').limit(50)
      .onSnapshot(snapshot => {
        snapshot.docChanges.forEach(change => {
          if (change.type === 'added') return this.addOrUpdateTask(change.doc);
          if (change.type === 'modified') return this.addOrUpdateTask(change.doc);
          if (change.type === 'removed') return this.removeTask(change.doc);
        });
      });
  };
  
  // Handle database changes

  addOrUpdateTask = (snapshot) => {
    this.setState(state => {
      return {
        tasks: {
          ...state.tasks,
          [snapshot.id]: snapshot.data()
        }
      };
    }, () => localStorage.setItem('tasks', JSON.stringify(this.state.tasks)));
  };

  removeTask = (snapshot) => {
    this.setState(state => {
      let tasks = { ...state.tasks };
      delete tasks[snapshot.id];
      return { tasks: tasks };
    }, () => {
      localStorage.setItem('tasks', JSON.stringify(this.state.tasks));
    });
  };

  // Handle user actions

  handleAddTask = (e) => {
    e.preventDefault();
    
    const task = {
      text: this.input.value,
      done: false,
      created: firebase.firestore.FieldValue.serverTimestamp()
    };

    this.db.collection(`users/${this.state.userId}/tasks`).add(task)
      .catch(this.dbError);
    
    this.input.value = '';
  };

  handleMarkDone = (taskId) => {
    this.db.collection(`users/${this.state.userId}/tasks`).doc(taskId).update({ done: true })
      .catch(this.dbError);
  };

  handleDeleteTask = (taskId) => {
    this.db.collection(`users/${this.state.userId}/tasks`).doc(taskId).delete()
      .catch(this.dbError);
  };

  dbError = (error) => {
    if (error) alert('Oops, technical difficulties. Try again in a minute.');
  };

  render() {
    const tasks = this.state.tasks;
    const taskIds = Object.keys(tasks);
    
    return (
      <main>
        <ul>
          {taskIds.map(taskId => {
            const task = tasks[taskId];

            return (
              <li key={taskId}
                style={{ textDecoration: task.done && 'strikethrough' }}
                onClick={task.done ? this.handleDeleteTask(taskId) : this.handleMarkDone(taskId)}
              >{task.text}</li>
            );
          })}
        </ul>

        <form onSubmit={this.handleAddTask}>
          <input type="text" ref={el => this.input = el} />
          <button type="submit">Add</button>
        </form>
          
        // Placeholder authentication component
        // More information: https://firebase.google.com/docs/auth/web/password-auth
        <AuthForm
          signedIn={this.state.userId.length}
          handleSignIn={this.handleSignIn}
          handleSignOut={this.handleSignOut}
        />
      </main>
    );
  }
}

export default App;
