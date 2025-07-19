const mainCanvas = document.getElementById('main-canvas')
const ctx = mainCanvas.getContext('2d')

function getMatchingObjs(objList, keyValPairs = {}) {
  const results = { found: false, matching: [] }
  Object.keys(keyValPairs).forEach((key) => {
    const searchParam = keyValPairs[key]
    const matching = objList.filter((ent) => searchParam.includes(ent[key]))
    results.found = matching.length > 0
    results.first = matching.length > 0 ? matching[0] : null
    results.all = matching
  })
  return results
}

function pos2d(x, y) {
  return { x: x, y: y }
}

function addPos(pos1, pos2) {
  return pos2d(pos1.x + pos2.x, pos1.y + pos2.y)
}

function subtractPos(pos1, pos2) {
  return pos2d(pos1.x - pos2.x, pos1.y - pos2.y)
}

function multiplyPos(pos1, pos2) {
  return pos2d(pos1.x * pos2.x, pos1.y * pos2.y)
}

function rect2d(pos, size) {
  return {
    pos: pos,
    size: size,
  }
}

function getEntRect(ent) {
  return rect2d(ent.pos, ent.size)
}

function getRectVerts(rect) {
  return [
    pos2d(rect.pos.x, rect.pos.y), // NW
    pos2d(rect.pos.x + rect.size.x, rect.pos.y), // NE
    pos2d(rect.pos.x, rect.pos.y + rect.size.y), // SW
    pos2d(rect.pos.x + rect.size.x, rect.pos.y + rect.size.y), // SE
  ]
}

function getRectSnapPoints(rect) {
  const pos = rect.pos
  const size = rect.size
  const midPointX = pos.x + (size.x / 2)
  const midPointY = pos.y + (size.y / 2)
  return {
    N: pos2d(midPointX, pos.y),
    S: pos2d(midPointX, pos.y + size.y),
    W: pos2d(pos.x, midPointY),
    E: pos2d(pos.x + size.x, midPointY),
    NW: pos2d(pos.x, pos.y),
    NE: pos2d(pos.x + size.x, pos.y),
    SW: pos2d(pos.x, pos.y + size.y),
    SE: pos2d(pos.x + size.x, pos.y + size.y),
    center: pos2d(midPointX, midPointY)
  }
}

function getRectSnapOffset(ent, pointName1, hostEnt, pointName2) {
  const destPos = getRectSnapPoints(ent)[pointName1] // e.g. 'S'
  const targetPos = getRectSnapPoints(hostEnt)[pointName2] // e.g. 'N'
  return subtractPos(targetPos, destPos)
}

function snapEnt2Ent(ent, pointName1, hostEnt, pointName2) {
  const vector2d = getRectSnapOffset(ent, pointName1, hostEnt, pointName2)
  translateEnt(ent, vector2d)
}

function ent2PosList(ent) {
  return getRectVerts(getEntRect(ent))
}

function getRectBounds(posList) {
  const xVals = posList.map((pos) => pos.x)
  const yVals = posList.map((pos) => pos.y)
  return {
    top: Math.min(...yVals),
    bottom: Math.max(...yVals),
    left: Math.min(...xVals),
    right: Math.max(...xVals),
  }
}

function points2Rect(posList) {
  const bounds = getRectBounds(posList)
  return {
    pos: pos2d(left, top),
    size: pos2d(right - left, bottom - top),
  }
}

function pointInBounds(point, bounds) {
  const insideX = bounds.left <= point.x && point.x <= bounds.right
  const insideY = bounds.top <= point.y && point.y <= bounds.bottom
  return insideX && insideY
}

function rectOverlapsRect(rect1, rect2) {
  const rect1Points = getRectVerts(rect1)
  const rect2Bounds = getRectBounds(getRectVerts(rect2))
  for (let i = 0; i < rect1Points.length; i++) {
    const pos = rect1Points[i]
    if (pointInBounds(pos, rect2Bounds)) return true    
  }
  return false
}

function rectWithinRect(rect1, rect2) {
  const rect1Points = getRectVerts(rect1)
  const rect2Bounds = getRectBounds(getRectVerts(rect2))
  for (let i = 0; i < rect1Points.length; i++) {
    const pos = rect1Points[i]
    if (!pointInBounds(pos, rect2Bounds)) return false    
  }
  return true
}

function rectsColliding(rect1, rect2) {
  return rectOverlapsRect(rect1, rect2) || rectOverlapsRect(rect2, rect1)
}

function entsColliding(ent1, ent2) {
  return rectsColliding(getEntRect(ent1), getEntRect(ent2))
}

var GAME = {
  SLOW_DOWN: 1, // this value is a denominator (e.g. '10' in 1/10)
  INTERVAL: 10,
  TICKS: 0,
  PAUSE: false,
  PLAYER_SPEED: 1,
  VIEW_WIDTH: 400,
  VIEW_HEIGHT: 400,
  VIEW_RECT() {
    return rect2d(
      getDirVec('zero'),
      pos2d(this.VIEW_WIDTH, this.VIEW_HEIGHT),
    )
  },
}

var ENT_TYPES = {
  PLAYER: {
    name: 'PLAYER',
    type: 'player',
    collision: true,
    pos: pos2d(GAME.VIEW_WIDTH / 2 - 33 / 2, 350),
    size: pos2d(33, 33),
    depth: 1,
    speed: 1,
    color: "rgb(200 0 0)",
    img: 'img/player.png',
    damage: 1,
    health: 100,
    beamCooldown: 0,
    defaultCooldown: 100,
    beamWidth: 0,
    update() {
      addDebugText('player-health', this.health)
      if (this.health <= 0) { killEnt(this) }
      this.color = `hsl(0 ${(10 - this.health) * 5} 50)`

      // handle all ArrowKey inputs
      Object.keys(DIRS).forEach((dirName) => {
        if (INPUT.get(dirName)) {
          translateEntInDir(this, dirName, this.speed, (newRect) => {
            return !rectWithinRect(newRect, GAME.VIEW_RECT())
          })
        }
      })

      if (INPUT.get('shoot')) {
        if (this.beamCooldown <= 0) {
          ['N', 'W', 'E'].forEach((snapPoint) => {
            if (this.beamWidth === 0 && snapPoint !== 'N') return // skip side beams at first
            const newBeam = createEnt(ENT_TYPES.BEAM, {
              color: '#00ff00cc',
              // img: 'img/player_beam2.png',
              target: 'enemy',
              dir: 'up',
              depth: 4,
              // size: pos2d(this.beamWidth, 33)
            })
            snapEnt2Ent(newBeam, 'S', this, snapPoint)
            const offsetFromPlayer = multiplyPos(NSWE[snapPoint], pos2d(this.beamWidth, 0))
            translateEnt(newBeam, offsetFromPlayer)
          })
          this.beamCooldown = this.defaultCooldown
        }
      }

      this.beamCooldown = this.beamCooldown > 0 ? this.beamCooldown -= 1 : 0
    },
  },
  ENEMY: {
    name: 'enemy',
    type: 'enemy',
    collision: true,
    pos: pos2d(33, 33),
    size: pos2d(33, -33),
    depth: 1,
    speed: 1,
    color: "rgb(200 0 0)",
    img: 'img/enemy.png',
    damage: 1,
    health: 1,
    beamCooldown: 100,
    flightVector: pos2d(0, 0),
    onDestroy() {
      if (randInt(0, 100) < 33) {
        const powerUpTypes = ['SPEED_UP', 'WIDTH_UP', 'HEALTH_UP']
        const newPowerupEnt = createEnt(ENT_TYPES[randItem(powerUpTypes)], { pos: this.pos })
        snapEnt2Ent(newPowerupEnt, 'center', this, 'center')
      }
      createEnt(ENT_TYPES.SPRITE, {
        size: pos2d(15, 15),
        targetEnt: this,
        animationType: 'expand',
        img: 'img/explosion.png'
      })
    },
    update() {
      translateEnt(this, this.flightVector)

      if (this.health <= 0) { killEnt(this) }
      this.color = `hsl(0 ${(10 - this.health) * 5} 50)`

      if (this.beamCooldown <= 0) {
        const newBeam = createEnt(ENT_TYPES.BEAM, {
          color: '#33ccff',
          target: 'player',
          dir: 'down',
        })
        snapEnt2Ent(newBeam, 'N', this, 'S')
        this.beamCooldown = randInt(100, 300)

        // const newVectorName = randItem(Object.keys(NSWE))
        const newVectorName = randItem(['S', 'SW', 'SE', 'zero'])
        this.flightVector = NSWE[newVectorName]
      }

      this.beamCooldown = this.beamCooldown > 0 ? this.beamCooldown -= 1 : 0
    },
  },
  BEAM: {
    name: 'beam',
    type: 'damager',
    target: 'player',
    collision: true,
    pos: pos2d(0, 0),
    size: pos2d(3, 33),
    depth: 5,
    dir: 'down',
    speed: 5,
    color: "rgba(0 0 200 0.3)",
    damage: 1,
    update() {
      translateEntInDir(this, this.dir, this.speed)
    },
  },
  SPEED_UP: {
    name: 'speedUp',
    type: 'speedUp',
    collision: true,
    pos: pos2d(200, 2),
    size: pos2d(24, 24),
    depth: 10,
    speed: .77,
    color: 'cyan',
    img: 'img/speed_up.png',
    flightVector: pos2d(0, .33),
    applyPowerup() {
      const playerEnt = getEnt('PLAYER')
      playerEnt.defaultCooldown -= 5
      if (playerEnt.defaultCooldown < 5) {
        playerEnt.defaultCooldown = 5
      }
    },
    update() {
      this.flightVector = pos2d(Math.cos(GAME.TICKS / 100), this.speed)
      translateEnt(this, this.flightVector)
    },
  },
  WIDTH_UP: {
    name: 'widthUp',
    type: 'widthUp',
    collision: true,
    pos: pos2d(200, 2),
    size: pos2d(24, 24),
    depth: 10,
    speed: .77,
    color: 'red',
    img: 'img/width_up.png',
    flightVector: pos2d(0, .33),
    applyPowerup() {
      const playerEnt = getEnt('PLAYER')
      playerEnt.beamWidth += 3
      if (playerEnt.beamWidth > 12) {
        playerEnt.beamWidth = 12
      }
    },
    update() {
      this.flightVector = pos2d(Math.cos(GAME.TICKS / 100), this.speed)
      translateEnt(this, this.flightVector)
    },
  },
  HEALTH_UP: {
    name: 'healthUp',
    type: 'healthUp',
    collision: true,
    pos: pos2d(200, 2),
    size: pos2d(24, 24),
    depth: 10,
    speed: .77,
    color: 'red',
    img: 'img/health_up.png',
    flightVector: pos2d(0, .33),
    applyPowerup() {
      const playerEnt = getEnt('PLAYER')
      playerEnt.health += 1
      if (playerEnt.health > 10) {
        playerEnt.health = 10
      }
    },
    update() {
      this.flightVector = pos2d(Math.cos(GAME.TICKS / 100), this.speed)
      translateEnt(this, this.flightVector)
    },
  },
  SPRITE: {
    name: 'sprite',
    type: 'sprite',
    pos: pos2d(0, 0),
    size: pos2d(33, 33),
    depth: 20,
    color: 'red',
    snapPoint: 'center',
    targetEnt: null,
    targetSnapPoint: 'center',
    animationType: null,
    animationTick: 0,
    animationStop: 20,
    update() {
      if (this.targetEnt) {
        snapEnt2Ent(this, this.snapPoint, this.targetEnt, this.targetSnapPoint)
      }
      if (this.animationType === 'expand') {
        this.size = addPos(this.size, pos2d(1, 1))
      }
      this.animationTick += 1
      if (this.animationTick > this.animationStop) {
        killEnt(this)
      }
    },
  },
  STAR: {
    name: 'star',
    type: 'star',
    pos: pos2d(0, 0),
    size: pos2d(3, 3),
    depth: -100,
    color: '#555555',
    speed: 2,
    update() {
      translateEntInDir(this, 'down', this.speed)
    },
  }
}

var ENTS = []

var COLORS = {
  BG: '#000000',
}

var DIRS = {
  up: pos2d(0, -1),
  down: pos2d(0, 1),
  left: pos2d(-1, 0),
  right: pos2d(1, 0),
  zero: pos2d(0, 0),
}

var NSWE = {
  N: pos2d(0, -1),
  S: pos2d(0, 1),
  W: pos2d(-1, 0),
  E: pos2d(1, 0),  
  NW: pos2d(-1, -1),
  SW: pos2d(-1, 1),
  NE: pos2d(1, -1),
  SE: pos2d(1, 1),
  zero: pos2d(0, 0), 
}

var EVENT_TYPES = {
  COLLISIONS: 'COLLISIONS',
}

var EVENTS = Object.keys(EVENT_TYPES).reduce((acc, eventType, i) => {
  acc[eventType] = []
  return acc
}, {})

function isOnScreen(entOrRect) {
  return rectsColliding(GAME.VIEW_RECT(), entOrRect)
}

function getOffScreenEnts() {
  return ENTS.filter((ent) => {
    return !isOnScreen(ent)
  })
}

function clearOffScreenEnts() {
  ENTS = ENTS.filter((ent) => {
    return isOnScreen(ent)
  })
}

function addEvent(eventType, props = {}) {
  EVENTS[eventType].push(props)
}

function checkCollisions() {
  const entsWithCollision = ENTS.filter((ent) => 'onCollision' in ent || ent.collision)
  for (let i = 0; i < entsWithCollision.length; i++) {
    const ent1 = entsWithCollision[i]
    // 'j = i + 1' ensures it's only the bottom left slice of pairings (i.e., all unique)
    for (let j = i + 1; j < entsWithCollision.length; j++) {
      const ent2 = entsWithCollision[j]
      if (rectsColliding(ent1, ent2)) {
        addEvent(EVENT_TYPES.COLLISIONS, { entList: [ent1, ent2] })
      }
    }
  }
}

function collisionInvolves(entList, entType1, entType2) {
  const ent1 = getMatchingObjs(entList, { type: entType1 })
  const ent2 = getMatchingObjs(entList, { type: entType2 })
  if (ent1.found && ent2.found) {
    return { entType1: ent1, entType2: ent2 }
  }

  return false
}

// Todo: refactor this so that each ent has a handleCollision() method
function handleCollisions() {
  checkCollisions()
  EVENTS[EVENT_TYPES.COLLISIONS].forEach((collision) => {
    const entList = collision.entList
    if (!Array.isArray(entList) || entList.length !== 2) return // skip if invalid
    
    const characterEnts = getMatchingObjs(entList, { type: 'player || enemy' })
    const damagerEnts = getMatchingObjs(entList, { type: 'damager' })

    if (characterEnts.found && damagerEnts.found) {
      if (characterEnts.first.type === damagerEnts.first.target) {
        characterEnts.first.health -= damagerEnts.first.damage
        killEnt(damagerEnts.first)
        createEnt(ENT_TYPES.SPRITE, {
          size: pos2d(15, 15),
          targetEnt: damagerEnts.first,
          animationType: 'expand',
          img: 'img/explosion.png'
        })
      }
    }
    
    const playerEnt = getMatchingObjs(entList, { type: 'player' })
    if (characterEnts.all.length === 2 && playerEnt.found) {
      characterEnts.all.forEach((character) => {
        character.health -= 5
      })
    }

    const powerupEnts = getMatchingObjs(entList, { type: 'speedUp || widthUp' })
    if (powerupEnts.found && playerEnt.found) {
      powerupEnts.first.applyPowerup()
      killEnt(powerupEnts.first)
    }
  })
  EVENTS[EVENT_TYPES.COLLISIONS] = []
}

function getDirVec(dirName, steps = 1) {
  let vector2d = DIRS.zero
  const dirVec = DIRS[dirName.toLowerCase()] ?? DIRS.zero
  for (let i = 0; i < steps; i++) {
    vector2d = addPos(vector2d, dirVec)
  }

  return vector2d ? vector2d : DIRS.zero
}

function getEnt(entName) {
  return ENTS.find((ent) => ent.name === entName)
}

function killEnt(ent, options = {}) {
  if ('onDestroy' in ent) {
    ent.onDestroy(options)
  }
  const index = ENTS.indexOf(ent)
  if (index !== -1) {
    ENTS.splice(index, 1)
  }
}

function moveEnt2Pos(ent, pos) {
  ent.pos = pos
}

function translateEnt(ent, vector2d, cancelFunc = null) {
  const newPos = addPos(ent.pos, vector2d)
  const newRect = rect2d(newPos, ent.size)
  if (cancelFunc && cancelFunc(newRect) ) return // abort if cancel condition met
  moveEnt2Pos(ent, newPos)
}

function translateEntInDir(ent, dirName, steps = 1, cancelFunc = null) {
  translateEnt(ent, getDirVec(dirName, steps), cancelFunc)
}

function updateEnts() {
  ENTS.forEach((ent) => {
    ent.update()
  })
}

function createEnt(prototype, customProps = {}) {
  const newEnt = {...prototype}
  updateObjProps(newEnt, customProps, 'overwrite')
  ENTS.push(newEnt)
  return newEnt
}

function drawBackground() {
  ctx.fillStyle = COLORS.BG
  ctx.fillRect(0, 0, mainCanvas.width, mainCanvas.height)
}

function drawRect(ent) {
  ctx.fillStyle = ent.color
  ctx.fillRect(ent.pos.x, ent.pos.y, ent.size.x, ent.size.y)
}

var IMAGES = Object.keys(ENT_TYPES).reduce((acc, entTypeKeyName, i) => {
  const entType = ENT_TYPES[entTypeKeyName].type
  acc[entType] = new Image()
  return acc
}, {})

function drawImg(ent) {
  const image = IMAGES[ent.type]
  image.src = ent.img
  ctx.drawImage(image, ent.pos.x, ent.pos.y, ent.size.x, ent.size.y)
}

function drawEnts() {
  ENTS.sort((a, b) => a.depth - b.depth)
  ENTS.forEach((ent) => {
    if('img' in ent) {
      drawImg(ent)
    } else if ('color' in ent) {
      drawRect(ent)
    }
  })
}

function drawScene() {
  drawBackground()
  drawEnts()
}

createEnt(ENT_TYPES.PLAYER)

setInterval(() => {
  GAME.TICKS += 1
  if (GAME.SLOW_DOWN > 1) {
    if (!(GAME.TICKS % GAME.SLOW_DOWN === 0)) return
  }

  if (GAME.PAUSE) return
  drawScene()
  updateEnts()
  handleCollisions()
  // if (entsColliding(getEnt('PLAYER'), getEnt('test'))) {
  //   getEnt('test').color = 'rgb(0 200 0)'
  // }
  clearOffScreenEnts()

  if (GAME.TICKS % 100 === 0) {
    const randX = randInt(0, GAME.VIEW_WIDTH + 1 - ENT_TYPES.ENEMY.size.x)
    createEnt(ENT_TYPES.ENEMY, { pos: pos2d(randX, 10) })
  }

  // if (GAME.TICKS % 50 === 0) {
  //   const randX = randInt(0, GAME.VIEW_WIDTH + 1 - ENT_TYPES.ENEMY.size.x)
  //   const powerUpTypes = ['SPEED_UP', 'WIDTH_UP']
  //   createEnt(ENT_TYPES[randItem(powerUpTypes)], { pos: pos2d(randX, 10) })
  // }

  if (GAME.TICKS % 5 === 0) {
    const randX = randInt(0, GAME.VIEW_WIDTH + 1 - ENT_TYPES.ENEMY.size.x)
    createEnt(ENT_TYPES.STAR, { pos: pos2d(randX, 0) })
  }

}, GAME.INTERVAL)

function addDebugText(elementId, textContent) {
  let debugElement
  if (getElement(elementId)) {
    debugElement = getElement(elementId)
  } else {
      debugElement = newElement({
        id: elementId,
        tag:'h4',
      })
  }
  debugElement.textContent = `${elementId}: ${textContent}`

  // try {
  //   debugElement = 
  //   console.log('found')
  // } catch (error) {
  // }
}

const gameSpeedDebugger = newElement({
  tag: 'input',
  type: 'range',
  value: '1',
  min: '1',
  max: '100',
})

gameSpeedDebugger.addEventListener('input', () => {
  GAME.SLOW_DOWN = gameSpeedDebugger.value
})

const inputDebugger = newElement({
  tag: 'h1'
})

var INPUT = {
  MAP: {
    up: 'ArrowUp',
    down: 'ArrowDown',
    left: 'ArrowLeft',
    right: 'ArrowRight',
    pause: 'Escape',
    shoot: ' ',
  },
  STATUS: {},
  update(key, isPressed) {
    this.STATUS[key] = isPressed
    inputDebugger.textContent = Object.keys(this.STATUS).map((key) => {
      return `\n${key}: ${this.STATUS[key]}`
    })
  },
  get(actionName) {
    const inputName = this.MAP[actionName]
    return this.STATUS[inputName]
  },
}

document.addEventListener('keyup', (event) => {
  INPUT.update(event.key, false)
})

document.addEventListener('keydown', (event) => {
  INPUT.update(event.key, true)


  if (event.key === 'Escape') {
    GAME.PAUSE = !GAME.PAUSE
    if (GAME.PAUSE) {
      drawBackground()
    }
  }
  if (GAME.PAUSE) return

})
