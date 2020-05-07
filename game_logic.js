'use strict';

/**
 * Extends Element to ease working with classes (based on EnyoJS v1)
 */
Element.make = function (_nodeType, _attributes) { // my own concoction
	var nodeType = (_nodeType !== undefined && typeof _nodeType === 'string') ? _nodeType : 'div',
		attr = (_attributes !== undefined && typeof _attributes === 'object') ? _attributes : {},
		el = document.createElement(nodeType),
		key, skey;
	for (key in attr) {
		if (key === 'innerHTML')
			el.innerHTML += attr[key];
		else if (key === 'events' && typeof attr[key] === 'object')
			for (skey in attr[key])
				el.addEventListener(skey, attr[key][skey], false);
		else if (key === 'elements') // best to list these first
			for (let index in attr[key])
				el.appendChild(attr[key][index]);
		else el.setAttribute(key, attr[key]);
	}
	return el;
};

var game_data = {
	'budget': 9000,
	
	'max_time': 9,

	'overtime': 2,

	'late_penalty_per_week': 2000,

	'max_workers_total': 5,

	'worker_types': [
		{
			'type'       : 'regular',
			'count'      : 4,
			'base_cost'  : 200,
			'cowork_cost': 50
		},
		{
			'type'       : 'extra',
			'count'      : 1,
			'base_cost'  : 300,
			'cowork_cost': 50
		}
	],

	'activities': [
		{
			'name': 'A',
			'description': 'Contract negotiation with selected music groups',
			'emoji': '&#129345;',
			'duration': 3,
			'max_workers': 2,
			'predecessors': []
		},
		{
			'name': 'B',
			'description': 'Find a construction firm & build the stage',
			'emoji': '&#128679;',
			'duration': 5,
			'max_workers': 2,
			'predecessors': ['C']
		},
		{
			'name': 'C',
			'description': 'Contract negotiation with roadies',
			'emoji': '&#129508;',
			'duration': 2,
			'max_workers': 2,
			'predecessors': []
		},
		{
			'name': 'D',
			'description': 'Screen and hire security personnel',
			'emoji': '&#128737;',
			'duration': 3,
			'max_workers': 2,
			'predecessors': []
		},
		{
			'name': 'E',
			'description': 'Ticket distribution arrangements',
			'emoji': '&#127915;',
			'duration': 1,
			'max_workers': 2,
			'predecessors': ['A']
		},
		{
			'name': 'F',
			'description': 'Organize advertising brochures and souvenir program printing',
			'emoji': '&#128717;',
			'duration': 4,
			'max_workers': 2,
			'predecessors': ['D']
		},
		{
			'name': 'G',
			'description': 'Logistical arrangements for music group transportation',
			'emoji': '&#128652;',
			'duration': 1,
			'max_workers': 2,
			'predecessors': ['E']
		},
		{
			'name': 'H',
			'description': 'Sound equipment arrangements',
			'emoji': '&#127928;',
			'duration': 3,
			'max_workers': 2,
			'predecessors': ['C', 'D']
		},
		{
			'name': 'I',
			'description': 'Processing of travel visas (for international groups)',
			'emoji': '&#128706;',
			'duration': 5,
			'max_workers': 2,
			'predecessors': ['F', 'H']
		},
		{
			'name': 'J',
			'description': 'Hire parking staff, and make parking arrangements',
			'emoji': '&#128661;',
			'duration': 4,
			'max_workers': 2,
			'predecessors': ['E', 'B', 'H']
		},
		{
			'name': 'K',
			'description': 'Distribute media passes and arrange for tv recording',
			'emoji': '&#127909;',
			'duration': 5,
			'max_workers': 2,
			'predecessors': ['G']
		},
		{
			'name': 'L',
			'description': 'Arrange for concession sales and restroom facilities',
			'emoji': '&#128704;',
			'duration': 2,
			'max_workers': 2,
			'predecessors': ['F']
		}
	]
};

class Graph {
	constructor () {
		this.nodes       = {};
		this.connections = {};

		// always make start and end nodes available
		this.addNode({
			'name'       : 'start',
			'emoji'      : '&#127793;',
			'total_weeks': 12,  // TODO remove hardcoded values
			'completed'  : true
		});
		this.addNode({
			'name'       : 'end',
			'emoji'      : '&#127937',
			'total_weeks': 12,
		});
	}

	addNode (nodeData) {
		let id = nodeData['name'];

		// add if new
		if (this.nodes[id] === undefined) {
			this.nodes[id] = new ActivityNode(this, nodeData);

			// add indicated connections
			if (id !== 'start' && id !== 'end') {
				if (this.nodes[id].predecessors.length > 0) {
					for (let i = this.nodes[id].predecessors.length - 1; i >= 0; i--) {
						this.addConnection(this.nodes[id].predecessors[i], id);
					}
				} else {
					// if no predecessors are listed, make start node a predecessor
					this.addConnection('start', id);
				}
			}

			this.updateConnections();

			return this.nodes[id];
		}
	}

	removeNode (nodeID) {
		// check if exists, if so delete node
		if (this.nodes[nodeID]) {
			delete this.nodes[nodeID]
		}
		
		this.updateConnections();
	}

	addConnection (aID, bID, skipUpdate) {
		let id = aID + '>' + bID;
		
		// add if new
		if (this.connections[id] === undefined) {
			// check status first
			let activeState = false;

			if (this.nodes[aID] && this.nodes[bID]) {
				activeState = true;
			}

			// a connection is always added but may simply not be active
			this.connections[aID + '>' + bID] = {
				'id'         : aID + '>' + bID,
				'origin'     : aID,
				'destination': bID,
				'active'     : activeState
			};
		}

		if (!skipUpdate) {
			this.updateConnections();
		}
	}

	removeConnection (aID, bID, skipUpdate) {
		// check if connection exists
		if (this.connections[aID + '>' + bID]) {
			delete this.connections[aID + '>' + bID];
		}

		if (!skipUpdate) {
			this.updateConnections();
		}
	}

	updateConnections () {
		// first, delete all start and end connections (ugly but works for now)
		let start_connections = this.getOutgoingConnections('start');
		for (let i = start_connections.length - 1; i >= 0; i--) {
			this.removeConnection( start_connections[i].origin, start_connections[i].destination, true );
		}

		let end_connections = this.getIncomingConnections('end');
		for (let i = end_connections.length - 1; i >= 0; i--) {
			this.removeConnection( end_connections[i].origin, end_connections[i].destination, true );
		}
		if (this.nodes['end']) {
			this.nodes['end'].removeAllPredecessors();
		}

		// iterate over all connections and update state
		for (let key in this.connections) {
			let n = this.connections[key];

			if (this.nodes[ n.origin ] && this.nodes[ n.destination ]) {
				n['active'] = true;
			} else if (this.nodes[ n.origin ] || this.nodes[ n.destination ]) {
				n['active'] = false;

				// handle special cases where one of the nodes is start or end
				if (this.nodes[ n.origin ] && n.origin === 'start') {
					delete this.connections[key];
				} else if (this.nodes[ n.destination ] && n.destination === 'end') {
					delete this.connections[key];
				}
			} else {
				// neither node exists
				delete this.connections[key];
			}
		}

		// re-init all start and end connections
		// find all nodes without incoming connections
		for (let id in this.nodes) {
			let in_cons = this.getIncomingConnections(id);
			if (in_cons.length == 0 && id !== 'start' && id !== 'end') {
				// if no predecessors are listed, make start node a predecessor
				this.addConnection('start', id, true);
			}

			let out_cons = this.getOutgoingConnections(id);
			if (out_cons.length == 0 && id !== 'start' && id !== 'end') {
				// if no follow-up nodes are listed, make end node a follow-up
				this.addConnection(id, 'end', true);

				// also list these connections for the end node itself
				if (this.nodes['end']) {
					this.nodes['end'].addPredecessor(id);
				}
			}
		}
	}

	getByFilter (objects, filter_function) {
		let filtered_objects = [];

		for (let key in objects) {
			if ( filter_function(objects[key]) ) {
				filtered_objects.push( objects[key] );  // links to object as reference, not a copy
			}
		}
		return filtered_objects;
	}

	getActiveConnections () {
		return this.getByFilter(this.connections, con => con['active']);
	}

	getInactiveConnections () {
		return this.getByFilter(this.connections, con => !con['active']);
	}

	// return list of any connection with nodeID as destination
	getIncomingConnections (nodeID) {
		return this.getByFilter(this.connections, con => con['destination'] === nodeID);
	}

	// return list of any connection with nodeID as origin
	getOutgoingConnections (nodeID) {
		return this.getByFilter(this.connections, con => con['origin'] === nodeID);
	}

	getStructure (nodeID) {
		let id        = nodeID ? nodeID : 'start';
		let outcons   = this.getOutgoingConnections(id);
		let structure = {};

		for (let i = 0; i < outcons.length; i++) {
			structure[ outcons[i].destination ] = this.getStructure(outcons[i].destination);
		}

		return structure;
	}
}

class ActivityNode {
	constructor (graph, data) {
		this.graph           = graph;
		this.id              = data['name'];
		this.description     = data['description'] || '';
		this.duration        = data['duration'] || 0;
		this.progress        = data['progress'] || 0;
		this.predecessors    = data['predecessors'] || [];
		this.started         = -1;
		this.workers         = [];
		this.max_workers     = data['max_workers'] || 2;
		this.emoji           = data['emoji'];
		this.total_weeks     = data['total_weeks'];

		this.init_gui();

		this.setCompleted( data['completed'] || false );
	}

	getNode(id) {
		return this.graph.nodes[id];
	}

	addPredecessor (pre) {
		// if new, add
		if (this.predecessors.indexOf(pre) == -1) {
			this.predecessors.push(pre);
		}
		this.canStart();
	}

	removePredecessor (pre) {
		// if available, remove
		let pre_index = this.predecessors.indexOf(pre);
		if (pre_index != -1) {
			this.predecessors.splice(pre_index, 1);
		}
		this.canStart();
	}

	removeAllPredecessors () {
		this.predecessors = [];
		this.canStart();
	}

	canStart () {
		// check if all predecessors have completed
		// note: every() returns true on empty arrays, which works fine here
		let canStart = this.predecessors.every((node) => node.completed);
		this.el.classList.toggle('activity-can-start', canStart);
		return canStart;
	}

	hasStarted () {
		return (this.started >= 0);
	}

	setStarted (when) {
		this.started = when;
		this.el.classList.toggle('activity-started', this.hasStarted());
	}

	setCompleted (state) {
		this.completed = !!state;
		if (this.completed && this.started == -1) {
			this.started = 0;  // at least has some sensible value
		}
		this.el.classList.toggle('activity-completed', this.completed);
	}

	addProgress (stepSize, now) {
		// check if we can start
		if (!this.hasStarted() && this.canStart()) {
			// check other preconditions as well
			if (this.duration == 0 || (this.duration > 0 && this.workers.length > 0)) {
				this.setStarted(now - stepSize);  // now is already updated with +stepSize
			}
		}

		// if we're active, progress
		if (this.hasStarted() && !this.completed) {
			// now, update progress
			this.progress += stepSize * this.workers.length;
			
			if (this.progress >= this.duration) {
				this.progress  = this.duration;
				this.setCompleted(true);
			}

			return true;
		}
		return false;
	}

	canProgress () {
		let canProgress = true;  // assume this activity does not halt progress

		// activities that have started must continue to have at least one worker assigned
		if (this.hasStarted() && !this.completed && this.workers.length == 0) {
			canProgress = false;
		}

		// also update its style
		this.el.classList.toggle('activity-cannot-progress', !canProgress);
		
		return canProgress;  
	}

	// returns the base duration left (assuming one worker)
	getRemainingDuration () {
		if (this.completed) {
			return 0;
		}
		return this.duration - this.progress;
	}

	// returns the duration left with current amount of workers (or assumes at least 1)
	getExpectedDuration () {
		if (this.completed) {
			return 0;
		}
		// remaining duration is always in full weeks (rounded up)
		return Math.ceil( (this.duration - this.progress) / Math.max(this.workers.length, 1));
	}

	getTotalExpectedDuration () {
		return this.progress + this.getExpectedDuration();
	}

	getExpectedStart () {
		let expected_start = 0;

		if (this.hasStarted()) {
			expected_start = this.started;
		} else {
			// calculate based on predecessor durations
			for (var i = 0; i < this.predecessors.length; i++) {
				let pre_node = this.getNode(this.predecessors[i]);

				if (pre_node) {
					expected_start = Math.max(pre_node.getExpectedEnding(), expected_start);
				}

				// compensate for being one week off
				// expected_start += 1;
			}
		}

		return expected_start;
	}

	getExpectedEnding () {
		return this.getExpectedStart() + this.getTotalExpectedDuration();
	}


	// useful to check eligibility before actually assigning
	canAssignWorker (workerID) {
		// note: does not check here if workerID exists
		if (!this.completed && this.canStart() && this.workers.length < this.max_workers && !this.workers.includes(workerID)) {
			return true;
		}
		return false; // can not assign
	}

	assignWorker (workerID, skipCheck) {
		if (skipCheck || this.canAssignWorker(workerID) ) {
			let result = this.workers.push(workerID);
			this.canProgress();
			this.update_width();
			return result;
		}
		this.canProgress();
		return false; // could not assign
	}

	removeWorker (workerID) {
		let worker_index = this.workers.indexOf(workerID);
		if (worker_index != -1) {
			let result = this.workers.splice(worker_index, 1);
			this.canProgress();
			this.update_width();
			return result;
		}
		return false; // could not remove
	}

	reset () {
		this.setStarted(-1);
		this.setCompleted( (this.id == 'start') ? true : false );
		this.cumulative_cost = 0;

		for (var i = this.workers.length - 1; i >= 0; i--) {
			this.removeWorker( this.workers[i] );
		}

		this.canStart();
		this.canProgress();
		this.update_left();
		this.update_top();
		this.update_width();
	}

	init_gui () {
		this.el = Element.make('div', {
			'id'       : 'activity_' + this.id,
			'class'    : 'activity',
			'title'    : this.id + ' (takes ' + this.duration + ' weeks)\n\nRequired to complete first: ' + this.predecessors.join(' + ')
		});
		document.getElementById('activity_area').appendChild(this.el);

		this.el_icon = Element.make('div', {
			'class'    : 'activity-icon',
			'innerHTML': '<span>' + this.emoji + '</span> ' + this.id
		});
		this.el.appendChild(this.el_icon);
		
		
		if (this.id !== 'start' && this.id !== 'end') {
			this.el_description = Element.make('div', {
				'class'    : 'activity-description',
				'innerHTML': this.description,
				'title'    : this.description
			})
			this.el_worker_zone = Element.make('div', {
				'id'   : 'activity_worker_zone_' + this.id,
				'class': 'activity-worker-zone'
			})

			this.el.appendChild(this.el_description);
			this.el.appendChild(this.el_worker_zone);

			this.el_icon.innerHTML += '<sub>' + this.duration + '</sub>';
		}

		this.canStart();
		this.canProgress();
		this.update_left();
		this.update_top();
		this.update_width();
	}

	update_left (left) {
		if (this.id !== 'start') {
			let x = 0;

			if (left) {
				x = left;
			} else {
				if (this.hasStarted()) {
					x = this.started / this.total_weeks;
				} else {
					// calculate a reasonable position based on predecessor durations
					x = (this.getExpectedStart() / this.total_weeks) * 0.85 + 0.08;
				}
			}

			this.el.style.left = (x * 100) + '%';
		}
	}

	update_top (top) {
		if (this.id !== 'start' && this.id !== 'end') {
			let y = 0;

			if (top) {
				y = top;
			} else {
				// calculate position based on hierarchy
				y = this.getCrossPosition();
			}

			this.el.style.top = (y * 100) + '%';
		}
	}

	getCrossPosition () {
		let pos = 0;

		if (this.id == 'start' || this.id == 'end') {
			pos = 0.5;
		} else {
			let predecessors = this.predecessors;
			if (this.predecessors.length == 0) {
				predecessors = ['start'];
			}

			let pre_average = 0;
			let siblings    = [];

			// get predecessors
			for (var i = 0; i < predecessors.length; i++) {
				let pre_node = this.getNode(predecessors[i]);

				if (pre_node) {
					pre_average += pre_node.getCrossPosition();

					// gather sibling info as well
					let new_siblings = this.graph.getOutgoingConnections(pre_node.id);
					for (var s = 0; s < new_siblings.length; s++) {
						if (siblings.indexOf(new_siblings[s].destination) == -1) {
							siblings.push(new_siblings[s].destination);
						}
					}
				}
			}
			// follow the average y position for predecessors
			pre_average = pre_average / predecessors.length;

			// adjust position based on relative position to siblings to avoid overlap
			let relative_pos = (siblings.indexOf(this.id) / (siblings.length - 1)) - 0.5;
			if (isNaN(relative_pos)) {
				relative_pos = 0;
			}
			// console.log(siblings, this.id, relative_pos);

			// TODO remove random element
			pos = (pre_average + relative_pos * 0.8) + Math.random() * 0.1;
		}
		// console.log(this.id, pos);
		return Math.min(Math.max(pos, 0.05), 0.7);
	}

	update_width (width) {
		if (this.id !== 'start' && this.id !== 'end') {
			let w = width || (this.getTotalExpectedDuration() / this.total_weeks);
			this.el.style.width = (w * 0.85 * 100) + '%';
		}
	}
}

class GameWorker {
	constructor (data) {
		this.id                = GameWorker.getNextID();
		this.type              = data['type'] || 'regular';
		this.base_cost         = data['base_cost'] || 200;
		this.cowork_cost       = data['cowork_cost'] || 50;
		this.assigned_activity = data['assigned_activity'] || undefined;
		this.emoji             = ['&#128034;', '&#128025;', '&#128029;', '&#129419;', '&#129412;', '&#128049;', '&#128025;', '&#128055;', '&#128040;'][this.id];
		
		this.init_gui();
	}

	assign (activityID) {
		// other eligibility checks are done elsewhere
		this.assigned_activity = activityID;
		return true;
	}

	unassign () {
		this.assigned_activity = undefined;
		return true;
	}

	getActivity () {
		return this.assigned_activity;
	}

	isActive () {
		return (this.assigned_activity !== undefined);
	}

	reset () {
		this.unassign();
	}

	init_gui () {
		this.el = Element.make('div', {
			'id'       : 'worker_' + this.id,
			'class'    : 'worker worker-' + this.type,
			'innerHTML': this.emoji,
			'title'    : this.type.charAt(0).toUpperCase() + this.type.slice(1) + ' worker\n\nCost: ' + this.base_cost + ' (+' + this.cowork_cost + ' if co-working)'
		});
		document.getElementById('worker_area').appendChild(this.el);

		// add relevant variables
		this.initialPos = {
			'x': 0,
			'y': 0
		}
		this.currentPos = {
			'x': 0,
			'y': 0
		}
		this.offsetPos = {
			'x': 0,
			'y': 0
		}
		this.dragActive = false;

		// add event listeners
		window.addEventListener('touchstart', this.dragStart.bind(this), false);
		window.addEventListener('touchend',   this.dragEnd.bind(this),   false);
		window.addEventListener('touchmove',  this.drag.bind(this),      false);

		window.addEventListener('mousedown',  this.dragStart.bind(this), false);
		window.addEventListener('mouseup',    this.dragEnd.bind(this),   false);
		window.addEventListener('mousemove',  this.drag.bind(this),      false);
	}

	dragStart (inEvent) {
		if (inEvent.type === 'touchstart') {
			this.initialPos.x = inEvent.touches[0].clientX - this.offsetPos.x;
			this.initialPos.y = inEvent.touches[0].clientY - this.offsetPos.y;
		} else {
			this.initialPos.x = inEvent.clientX - this.offsetPos.x;
			this.initialPos.y = inEvent.clientY - this.offsetPos.y;
		}

		if (inEvent.target === this.el) {
			this.dragActive = true;
			document.getElementsByTagName('body')[0].classList.toggle('drag-active', true);
		}
	}

	drag (inEvent) {
		if (this.dragActive) {
			inEvent.preventDefault();

			if (inEvent.type === 'touchmove') {
				this.currentPos.x = inEvent.touches[0].clientX - this.initialPos.x;
				this.currentPos.y = inEvent.touches[0].clientY - this.initialPos.y;
			} else {
				this.currentPos.x = inEvent.clientX - this.initialPos.x;
				this.currentPos.y = inEvent.clientY - this.initialPos.y;
			}

			this.offsetPos.x = this.currentPos.x;
			this.offsetPos.y = this.currentPos.y;

			this.setTranslate(this.currentPos.x, this.currentPos.y, this.el);
		}
	}

	dragEnd () {
		//
		this.initialPos.x = this.currentPos.x;
		this.initialPos.y = this.currentPos.y;
		this.dragActive = false;
		document.getElementsByTagName('body')[0].classList.toggle('drag-active', false);
	}

	setTranslate (x, y) {
		this.el.style.transform = "translate3d(" + x + "px, " + y + "px, 0)";
    }
}
// static field - declared here for compatibility reasons
GameWorker.nextID = 0;
// static function
GameWorker.getNextID = function () {
	return GameWorker.nextID++;
}

class PMGame {
	constructor () {
		this.d = game_data;

		// init activity structure
		this.graph = new Graph();

		// add nodes
		for (let i = 0; i < this.d.activities.length ; i++) {
			let data = this.d.activities[i];
			data['total_weeks'] = this.d.max_time + this.d.overtime + 1;
			this.graph.addNode( data );
		}
		this.activities = this.graph.nodes;  // easier reference

		// add workers
		this.workers = [];
		for (let i = 0; i < this.d.worker_types.length; i++) {
			let worker_type = this.d.worker_types[i];

			for (let c = 0; c < worker_type.count; c++) {
				this.workers.push( new GameWorker(worker_type) );
			}
			
		}

		// init game variables
		this.now = 0;

		// remove the curtains
		this.init_gui();
	}

	playTurn () {
		if (!this.isFinished() && this.canProgress()) {
			this.addProgress(1);
		}
	}

	isFinished () {
		return this.activities['end'].completed;
	}

	reset () {
		// reset workers
		for (let i = this.workers.length - 1; i >= 0; i--) {
			this.workers[i].reset();
		}
		
		// reset all activities
		for (let key in this.activities) {
			this.activities[key].reset();
		}

		// reset internal variables
		this.now = 0;
	}

	canProgress () {
		return (this.graph.getByFilter(this.activities, node => !node.canProgress()).length == 0);
	}

	addProgress (stepSize) {
		let step = stepSize || 1;
		this.now += step;

		// call addProgress for each activity
		for (let nodeKey in this.activities) {
			let node = this.activities[nodeKey];

			// no need to handle inactive activities
			if (node.canProgress()) {
				node.addProgress(step, this.now);

				// unassign workers when complete
				if (node.complete) {
					for (let i = node.workers.length - 1; i >= 0; i--) {
						let removed_workerID = node.removeWorker( node.workers[i] );
						
						// when successful, also unassign the activity from the worker
						if (removed_workerID) {
							let worker = this.getWorker(removed_workerID);

							if (worker.getActivity() == node.id) {
								worker.unassign(node.id);
							}
						}
					}
				}
			}
		}
	}

	getWorker (workerID) {
		for (var i = 0; i < this.workers.length; i++) {
			if (this.workers[i].id === workerID) {
				return this.workers[i];
			}
		}
		// if not found
		return undefined;
	}

	// getActiveWorkers () {
	// 	return this.workers.filter(worker => worker.isActive());
	// }

	assignWorker (activityID, workerID) {
		let worker = this.getWorker(workerID);

		// if worker exists, continue
		if (worker) {
			// check if activity can have a worker assigned (returns false if not)
			if ( this.activities[activityID].canAssignWorker(worker.id) ) {
				let ok_to_continue = true;

				if (worker.isActive()) {
					// unassign from current activity first
					let current_activity = worker.getActivity();
					ok_to_continue = this.activities[current_activity].removeWorker(worker.id);
				}

				if (ok_to_continue) {
					let a_success = this.activities[activityID].assignWorker(worker.id);
					let w_success = worker.assign(activityID);
					return (a_success && w_success);
				}
			}
		}
		return false;
	}

	removeWorker (activityID, workerID) {
		let worker = this.getWorker(workerID);

		if (worker) {
			// check if worker can be removed from activity, by removing it
			this.activities[activityID].removeWorker(worker.id);

			// if so, check if worker can unassign itself, by doing so
			worker.unassign();

			return true;
		}
		return false;
	}

	getBudget () {
		let cumulative_costs = 0;
		let current_costs    = 0;
		let fines            = Math.max(0, this.now - this.d.max_time) * this.d.late_penalty_per_week;

		for (let key in this.activities) {
			cumulative_costs += this.activities[key].cumulative_cost;
			current_costs    += this.getCurrentActivityCost(key);
		}

		return {
			'budget'          : this.d.budget,
			'cumulative_costs': cumulative_costs,
			'current_costs'   : current_costs,
			'fines'           : fines,
			'total_costs'     : cumulative_costs + cumulative_costs + fines
		}
	}

	getCurrentActivityCost (activityID) {
		let activity = this.activities[activityID];
		let cost = 0;
		
		for (let i = activity.workers.length - 1; i >= 0; i--) {
			let worker = this.getWorker(activity.workers[i]);
			cost += worker.base_cost;

			// add cowork cost if there are more workers
			if (activity.workers.length > 1) {
				cost += worker.cowork_cost;
			}
		}

		return cost;
	}

	init_gui () {
		// listen for drag and drop of workers

		// TODO: remove // reset fixes some UI glitches
		this.reset();
	}

	getWeekPosition (week) {
		let position = week / (this.d.max_time + this.d.overtime);
		return position;
	}

	/**
	TODO:
	- layout activity divs
	- set and update positions for activity divs
	- add timeline
	- add run/turn button
	- add feedback
	- fix description toggle


	-- emojis:
	clock   : &#9200;
	festival: &#127914;
	**/
}

// ----------------------------------------------------------------------------

/**
 * Wait for whole page to load before setting up.
 * Prevents problems with objects not loaded yet while trying to assign these.
 */
window.addEventListener('pageshow', function () {
	window.game     = new PMGame();
}, false);