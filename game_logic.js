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
	constructor (pmg) {
		this.pm_game     = pmg;
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

		this.init_gui();
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
			this.connections[id] = {
				'id'         : id,
				'origin'     : aID,
				'destination': bID,
				'active'     : activeState
			};

			// add arrow element (if it doesn't exist yet, which it shouldn't)
			if (!document.getElementById(id)) {
				let arrow = Element.make('div', {
					'id'   : `arrow_${id}`,
					'class': 'arrow'
				});
				document.getElementById('activity_area').appendChild(arrow);
			}
		}

		if (!skipUpdate) {
			this.updateConnections();
		}
	}

	removeConnection (aID, bID, skipUpdate) {
		let id = aID + '>' + bID;

		// check if connection exists
		if (this.connections[id]) {
			delete this.connections[id];

			// remove arrow element
			let arrow = document.getElementById(`arrow_${id}`);
			if (arrow) {
				document.getElementById('activity_area').removeChild(arrow);
			}
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
					this.removeConnection(n.origin, n.destination, true);
					// delete this.connections[key];
				} else if (this.nodes[ n.destination ] && n.destination === 'end') {
					this.removeConnection(n.origin, n.destination, true);
					// delete this.connections[key];
				}
			} else {
				// neither node exists
				this.removeConnection(n.origin, n.destination, true);
				// delete this.connections[key];
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

	init_gui () {
		window.addEventListener('resize', this.update_gui.bind(this));
	}

	update_gui () {
		// update connection arrows
		for (let key in this.connections) {
			let conn   = this.connections[key];

			// get element by its id
			let arrow  = document.getElementById(`arrow_${conn.id}`);

			if (conn.active) {
				let a_area_top = document.getElementById('activity_area').getBoundingClientRect().top;

				// get in and out positions
				let out_pos = this.nodes[conn.origin].getExitPosition();
				let in_pos  = this.nodes[conn.destination].getEntryPosition();

				// draw and place in appropriate spot
				let length = Math.sqrt(Math.pow(in_pos.x - out_pos.x,2) + Math.pow(in_pos.y - out_pos.y,2));
				let angle  = Math.atan2( (in_pos.y - out_pos.y) , (in_pos.x - out_pos.x) );
				// console.log(conn.id, length, angle, out_pos, in_pos);

				arrow.style.top       = (out_pos.y - a_area_top) + 'px';
				arrow.style.left      = out_pos.x + 'px';
				arrow.style.width     = length + 'px';
				arrow.style.transform = `rotate(${angle}rad)`;
				arrow.setAttribute('title', `${conn.origin} → ${conn.destination}`);
				arrow.style.display   = '';
			} else {
				arrow.style.display = 'none';
			}
		}
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
		this.finished        = undefined;
		this.workers         = [];
		this.max_workers     = data['max_workers'] || 2;
		this.emoji           = data['emoji'];
		this.cumulative_cost = 0;
		this.total_weeks     = 0;
		this.now             = 0;

		this.init_gui();

		this.setCompleted( data['completed'] || false );

		// setup event listeners
		window.addEventListener('nowupdate',            this.getNow.bind(this), false);
		window.addEventListener('weeksupdate',          this.getWeeks.bind(this), false);
		window.addEventListener('activitycompleted',    this.getActivityUpdate.bind(this), false);
		window.addEventListener('activityworkerchange', this.getActivityUpdate.bind(this), false);
	}

	getNode(id) {
		return this.graph.nodes[id];
	}

	getWorker (id) {
		return this.graph.pm_game.getWorker(id);
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
		let canStart = this.predecessors.every((nodeID) => {
			let node = this.getNode(nodeID);

			return (node && node.completed);
		});
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

		if (this.completed) {
			this.finished = (this.duration === 0) ? Math.max(this.started, this.now - 1) : this.now;
		} else {
			this.finished = undefined;
		}
		this.el.classList.toggle('activity-completed', this.completed);

		// send out event to notify
		if (this.completed) {
			let ev = new CustomEvent('activitycompleted', {detail: {'activity': this.id} });
			window.dispatchEvent(ev);
		}
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

			// update costs
			this.cumulative_cost += stepSize * this.getCurrentCost();

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
		if (this.hasStarted() && !this.completed) {
			return (this.now - this.started) + this.getExpectedDuration();
		} else if (this.completed) {
			return this.finished - this.started;
		} else {
			return this.getExpectedDuration();
		}
	}

	getExpectedStart () {
		let expected_start = this.now;

		if (this.hasStarted()) {
			expected_start = this.started;
		} else {
			// calculate based on predecessor durations
			for (var i = 0; i < this.predecessors.length; i++) {
				let pre_node = this.getNode(this.predecessors[i]);

				if (pre_node) {
					expected_start = Math.max(pre_node.getExpectedEnding(), expected_start);
				}
			}
		}

		return expected_start;
	}

	getExpectedEnding () {
		return this.getExpectedStart() + this.getTotalExpectedDuration();
	}

	getNow (inEvent) {
		this.now = inEvent.detail.now;
	}

	getWeeks (inEvent) {
		this.total_weeks = inEvent.detail.total_weeks;

		this.update_gui();
	}

	getActivityUpdate (inEvent) {
		let a_id = inEvent.detail.activity;

		if (a_id === this.id) {
			return;  // no need to handle own events
		}

		if (inEvent.type === 'activitycompleted' || inEvent.type === 'activityworkerchange') {
			if (!this.hasStarted() && this.predecessors.indexOf(a_id) != -1) {
				// re-evaluate this node's situation
				this.canStart();
				this.update_gui();
			}
		}
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

			let ev = new CustomEvent('activityworkerchange', {detail: {'activity': this.id} });
			window.dispatchEvent(ev);

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

			let ev = new CustomEvent('activityworkerchange', {detail: {'activity': this.id} });
			window.dispatchEvent(ev);

			return result;
		}
		return false; // could not remove
	}

	getCurrentCost () {
		let cost = 0;
		
		for (var i = 0; i < this.workers.length; i++) {
			let worker = this.getWorker(this.workers[i]);
			
			cost += worker.base_cost;

			// add cowork cost if there are more workers
			if (this.workers.length > 1) {
				cost += worker.cowork_cost;
			}
		}

		return cost;
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

	update_gui () {
		this.update_left();
		this.update_width();

		if (this.id !== 'start' && this.id !== 'end') {
			let can_accept_workers = (!this.completed && this.canStart() && this.workers.length < this.max_workers);
			
			this.el.classList.toggle('can-accept-workers',     can_accept_workers);
			this.el.classList.toggle('cannot-accept-workers', !can_accept_workers);
		}
	}

	update_left (left) {
		if (this.id !== 'start') {
			let x = 0;

			if (left) {
				x = left;
			} else {
				if (this.hasStarted()) {
					x = (this.started / this.total_weeks) * 0.85 + 0.08;
				} else {
					// calculate a reasonable position based on predecessor durations
					x = (this.getExpectedStart() / this.total_weeks) * 0.85 + 0.08;
				}
			}
			this.el.style.left = this.el_style_left = (x * 100) + '%';
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

			this.el.style.top = this.el_style_top = (y * 100) + '%';
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
			this.el.style.width = this.el_style_width = (w * 0.85 * 100) + '%';
		}
	}

	check_overlap (other_position) {
		let s = this.el.getBoundingClientRect();
		let o = other_position;

		// use middle position for other element as it may not always fit entirely
		if (s.left < o.x && s.right > o.x && s.top < o.y && s.bottom > o.y) {
			return true;
		}
		// else
		return false;
	}

	getEntryPosition () {
		let s = this.el.getBoundingClientRect();
		let e_pos = {
			'x': s.left + 10,
			'y': s.top + (s.height / 2)
		}
		return e_pos;
	}

	getExitPosition () {
		let s = this.el.getBoundingClientRect();
		let e_pos = {
			'x': s.right - 10,
			'y': s.top + (s.height / 2)
		}
		return e_pos;
	}
}

class GameWorker {
	constructor (data) {
		this.id                = GameWorker.getNextID();
		this.type              = data['type'] || 'regular';
		this.base_cost         = data['base_cost'] || 200;
		this.cowork_cost       = data['cowork_cost'] || 50;
		this.assigned_activity = data['assigned_activity'] || undefined;
		this.emoji             = ['&#128034;', '&#128025;', '&#128029;', '&#129419;', '&#129412;', '&#128049;', '&#128055;', '&#128040;'][this.id];
		
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
			this.dragStartingElement = this.el.parentElement;
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

			this.setTranslate(this.currentPos.x, this.currentPos.y);
		}
	}

	dragEnd () {
		if (this.dragActive) {
			// let assignment decisions happen elsewhere
			let ev = new CustomEvent('workerdragend', {
				detail: {
					'worker'       : this,
					'bounding_rect': this.el.getBoundingClientRect()
				}
			});
			window.dispatchEvent(ev);

			// always reset to original position
			this.initialPos.x = this.currentPos.x = this.offsetPos.x = 0;
			this.initialPos.y = this.currentPos.y = this.offsetPos.y = 0;
			this.setTranslate(0,0);

			this.dragActive = false;
			document.getElementsByTagName('body')[0].classList.toggle('drag-active', false);
		}
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
		this.d                        = game_data;
		this.total_weeks              = 0;
		this.gui_initiated            = false;
		this.cumulative_inactive_cost = 0;

		// init activity structure
		this.graph = new Graph(this);

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
		this.setTime(0);
		this.updateTotalWeeks();

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

	setTime (time) {
		this.now = time;
		let ev = new CustomEvent('nowupdate', {detail: {'now': this.now}});
		window.dispatchEvent(ev);
	}

	updateTotalWeeks () {
		let end_start = this.activities['end'].getExpectedStart();
		let min_time  = this.d.max_time + this.d.overtime;

		let new_total_weeks = Math.max(end_start, min_time);

		if (new_total_weeks != this.total_weeks) {
			this.total_weeks = new_total_weeks;
			let ev = new CustomEvent('weeksupdate', {detail: {'total_weeks': this.total_weeks}});
			window.dispatchEvent(ev);

			this.update_gui();
		}

		return this.total_weeks;
	}

	getWeekPosition (week) {
		let position = week / this.total_weeks;
		return position;
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
		this.setTime(0);

		// update other stuff
		this.update_gui();
	}

	canProgress () {
		let node_progress = (this.graph.getByFilter(this.activities, node => !node.canProgress()).length == 0);
		let within_time   = (this.now <= this.d.max_time + this.d.overtime);
		return (node_progress && within_time && !this.isFinished());
	}

	addProgress (stepSize) {
		let step = stepSize || 1;

		// update time
		this.setTime(this.now + step);

		// call addProgress for each activity
		for (let nodeKey in this.activities) {
			let node = this.activities[nodeKey];

			// no need to handle inactive activities
			if (node.canProgress()) {
				node.addProgress(step, this.now);

				// unassign workers when complete
				if (node.completed) {
					for (let i = node.workers.length - 1; i >= 0; i--) {
						this.removeWorker(node.id, node.workers[i]);
					}
				}

				node.update_gui();
			}
		}

		this.updateTotalWeeks();
		this.update_gui();
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

	getInactiveWorkers () {
		return this.workers.filter(worker => !worker.isActive());
	}

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

					// re-parent the worker to the new activity
					this.activities[activityID].el_worker_zone.appendChild(worker.el);

					// make sure UI reflects the new state
					this.activities[activityID].update_gui();
					this.update_gui();

					return (a_success && w_success);
				}
			}
		}
		return false;
	}

	removeWorker (activityID, workerID) {
		let worker = this.getWorker(workerID);

		if (worker && activityID) {
			// check if worker can be removed from activity, by removing it
			this.activities[activityID].removeWorker(worker.id);

			// if so, check if worker can unassign itself, by doing so
			worker.unassign();

			// remove worker element by adding it to the worker zone
			document.getElementById('worker_area').appendChild(worker.el);

			// make sure UI reflects the new state
			this.activities[activityID].update_gui();
			this.update_gui();
					
			return true;
		}
		return false;
	}

	getBudget () {
		let cumulative_costs = this.cumulative_inactive_cost;
		let current_costs    = 0;
		let fines            = 0;

		if (this.isFinished()) {
			fines = Math.max(0, this.activities['end'].finished - this.d.max_time) * this.d.late_penalty_per_week;
		} else {
			fines = Math.max(0, this.now - this.d.max_time) * this.d.late_penalty_per_week;
		}

		// do a better check for fines
		if (this.isFinished()) {
			fines = Math.max(0, this.activities['end'].finished - this.d.max_time) * this.d.late_penalty_per_week;
		}

		// add per activity cumulative costs
		for (let key in this.activities) {
			cumulative_costs += this.activities[key].cumulative_cost;
			current_costs    += this.getCurrentActivityCost(key);
		}

		return {
			'budget'          : this.d.budget,
			'cumulative_costs': cumulative_costs,
			'current_costs'   : current_costs,
			'fines'           : fines,
			'total_costs'     : cumulative_costs + current_costs + fines
		}
	}

	getCurrentActivityCost (activityID) {
		let activity = this.activities[activityID];
		
		if (activity) {
			return activity.getCurrentCost();
		}
		// else
		return 0;
	}

	init_gui () {
		// init description
		this.el_description = document.getElementById('description');
		this.description_open = true;
		document.getElementById('description_toggle_button').addEventListener('click', this.toggleDescriptionArea.bind(this), false);

		// init timeline
		this.el_timeline = document.getElementById('timeline_area');
		// generate a bunch of weeks (enough to never run out)
		this.el_weeks = [];
		for (var i = 0; i < 2 * this.total_weeks + 1; i++) {
			let content = i;
			let title   = 'Week ' + i;

			if (i == this.d.max_time) {
				content  = '&#9200;';
				title   += ' (Deadline)';
			} else if (i == this.d.max_time + this.d.overtime) {
				content = '&#127914;';
				title  += ' (Festival takes place)';
			}
			let week_el = Element.make('div', {
				'id'       : 'week' + i,
				'class'    : 'week-item',
				'innerHTML': content,
				'title'    : title
			});
			week_el.style.left = (this.getWeekPosition(i) * 0.85 + 0.08) * 100 + '%';
			this.el_timeline.appendChild(week_el);
			this.el_weeks.push(week_el);
		}

		this.el_now = Element.make('div', {
			'id'   : 'week_now',
			'class': 'week-item-now',
			'title': 'Now'
		});
		this.el_timeline.appendChild(this.el_now);

		this.el_progress_button = document.getElementById('progress_button');
		this.el_progress_button.addEventListener('click', this.playTurn.bind(this), false);

		// listen for drag and drop of workers
		window.addEventListener('workerdragend', this.check_worker_drag.bind(this), false);

		// signal we're done setting up the GUI
		this.gui_initiated = true;

		// TODO: remove // reset fixes some UI glitches for now
		this.reset();
	}

	update_gui () {
		if (!this.gui_initiated) {
			return;  // keeps us from running into undefined errors below
		}

		// adjust timeline
		this.el_now.style.left = (this.getWeekPosition(this.now) * 0.85 + 0.08) * 100 + '%';
		for (var i = 0; i < this.el_weeks.length; i++) {
			this.el_weeks[i].style.left = (this.getWeekPosition(i) * 0.85 + 0.08) * 100 + '%';
			this.el_weeks[i].style.display = (i <= this.total_weeks) ? '' : 'none';
		}

		// update progress ability
		let can_progress = this.canProgress();
		let time_available = (this.now <= (this.d.max_time + this.d.overtime));
		this.el_progress_button.classList.toggle('cannot-progress', !can_progress);

		let title = 'Click to progress one week';
		if (!can_progress && !time_available) {
			title = 'You missed the deadline, the festival is a mess...'
		} else if (!can_progress) {
			title = 'Check worker assignments before proceeding.';
		}
		this.el_progress_button.setAttribute('title', title);

		// update budget
		let b = this.getBudget();
		document.getElementById('budget_cumulative').innerHTML = b.cumulative_costs;
		document.getElementById('budget_current').innerHTML    = b.current_costs;
		document.getElementById('budget_fines').innerHTML      = b.fines;
		document.getElementById('budget_total').innerHTML      = '&#128184; ' + b.total_costs;
		document.getElementById('budget_available').innerHTML  = '&#128176; ' + b.budget;

		document.getElementById('budget_header').classList.toggle('overbudget', (b.total_costs > b.budget));

		// update arrows
		this.graph.update_gui();

		if (this.isFinished()) {
			window.alert(`Congratulations!\n\nYou have completed the project in ${this.now-1} weeks.\n\nYour expenses were ${b.total_costs} versus a budget of ${b.budget}.`);
		} else if (this.now > this.d.max_time + this.d.overtime) {
			window.alert(`Unfortunately, you missed the deadline, the festival is a mess...`);	
		}
	}

	toggleDescriptionArea () {
		this.description_open = !this.description_open;
		document.getElementsByTagName('body')[0].classList.toggle('no-description', !this.description_open);
		this.el_description.classList.toggle('description-hidden', !this.description_open);
		
		if (!this.description_open) {
			window.scrollTo(0,0);
		}
	}

	check_worker_drag (inEvent) {
		// attempt to find where a worker drag event ended
		let worker               = inEvent.detail.worker;
		let wr                   = inEvent.detail.bounding_rect;
		let wp                   = {
			'x': wr.left + (wr.right - wr.left) / 2,
			'y': wr.top + (wr.bottom - wr.top) / 2
		}
		let overlapping_activity = undefined;

		for (let key in this.activities)  {
			if ( this.activities[key].check_overlap(wp) ) {
				overlapping_activity = this.activities[key];
			}
		}

		// when a suitable activity is found, assign the worker to it
		if (overlapping_activity) {
			this.assignWorker(overlapping_activity.id, worker.id);
		} else {
			// check if the worker zone was targeted
			let s = document.getElementById('workers').getBoundingClientRect();

			// use middle position for worker element as it may not always fit entirely
			if (s.left < wp.x && s.right > wp.x && s.top < wp.y && s.bottom > wp.y) {
				// remove worker from current activity (which resets to the worker zone)
				this.removeWorker(worker.assigned_activity, worker.id);
			}	
		}
	}

	/**
	TODO:
	- non-overlapping vertical layout activity divs
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