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

function deg2rad(degrees) {
  return degrees * Math.PI / 180
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
  VIEW_WIDTH: mainCanvas.width,
  VIEW_HEIGHT: mainCanvas.height,
  VIEW_RECT() {
    return rect2d(
      pos2d(0, 0),
      pos2d(this.VIEW_WIDTH, this.VIEW_HEIGHT),
    )
  },
}

var ENT_TYPES = {
  PLAYER: {
    name: 'PLAYER',
    type: 'player',
    pos: pos2d(GAME.VIEW_WIDTH / 2 - 33 / 2, 350),
    size: pos2d(33, 33),
    depth: 1,
    speed: 1,
    color: "rgb(200 0 0)",
    img: 'img/player.png',
    damage: 1,
    health: 10,
    beamCooldown: 0,
    defaultCooldown: 100,
    beamWidth: 0,
    onCollision(hitEnt) {
      if (['enemy'].includes(hitEnt.type)) {
        this.health -= 5
      }
    },
    update() {
      if (this.health <= 0) { killEnt(this) }
      // this.color = `hsl(0 ${(10 - this.health) * 5} 50)`

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
              shotBy: this.type,
              dir: 'up',
              depth: 4,
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
    onDestroy() {
      addExplosion(this)
    },
  },
  ENEMY: {
    name: 'enemy',
    type: 'enemy',
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
    onCollision(hitEnt) {
      if (['player'].includes(hitEnt.type)) {
        this.health -= 5
      }
    },
    onDestroy() {
      if (randInt(0, 100) < 33) {
        const powerUpTypes = ['SPEED_UP', 'WIDTH_UP', 'HEALTH_UP']
        const newPowerupEnt = createEnt(ENT_TYPES[randItem(powerUpTypes)], { pos: this.pos })
        snapEnt2Ent(newPowerupEnt, 'center', this, 'center')
      }
      addExplosion(this)
    },
    update() {
      translateEnt(this, this.flightVector)

      if (this.health <= 0) { killEnt(this) }
      this.color = `hsl(0 ${(10 - this.health) * 5} 50)`

      if (this.beamCooldown <= 0) {
        if (this.pos.y > 13) {
          const newBeam = createEnt(ENT_TYPES.BEAM, {
            color: '#33ccff',
            shotBy: this.type,
            dir: 'down',
          })
          snapEnt2Ent(newBeam, 'N', this, 'S')
        }
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
    shotBy: 'enemy',
    pos: pos2d(0, 0),
    size: pos2d(3, 33),
    depth: 5,
    dir: 'down',
    speed: 5,
    color: "rgba(0 0 200 0.3)",
    damage: 1,
    onCollision(hitEnt) {
      if (hitEnt.type === this.shotBy) return // prevent friendly fire
      if (['player', 'enemy', 'asteroid'].includes(hitEnt.type)) {
        hitEnt.health -= this.damage
        killEnt(this)
      }
    },
    onDestroy() {
      addExplosion(this)
    },
    update() {
      translateEntInDir(this, this.dir, this.speed)
    },
  },
  COLLECTABLE: {
    name: 'collectable',
    type: 'collectable',
    pos: pos2d(0, 0),
    size: pos2d(24, 24),
    depth: 10,
    speed: .77,
    color: 'cyan',
    flightVector: pos2d(0, .33),
    update() {
      this.flightVector = pos2d(Math.cos(GAME.TICKS / 100), this.speed)
      translateEnt(this, this.flightVector)
    },
  },
  SPEED_UP: {
    inheritFrom: ['COLLECTABLE'],
    img: 'img/speed_up.png',
    onCollision(hitEnt) {
      if (['player'].includes(hitEnt.type)) {
        hitEnt.defaultCooldown -= 5
        if (hitEnt.defaultCooldown < 5) {
          hitEnt.defaultCooldown = 5
        }
        killEnt(this)
      }
    },
  },
  WIDTH_UP: {
    inheritFrom: ['COLLECTABLE'],
    img: 'img/width_up.png',
    onCollision(hitEnt) {
      if (['player'].includes(hitEnt.type)) {
        hitEnt.beamWidth += 3
        if (hitEnt.beamWidth > 12) {
          hitEnt.beamWidth = 12
        }
        killEnt(this)
      }
    },
  },
  HEALTH_UP: {
    inheritFrom: ['COLLECTABLE'],
    img: 'img/health_up.png',
    onCollision(hitEnt) {
      if (['player'].includes(hitEnt.type)) {
        hitEnt.health += 1
        if (hitEnt.health > 10) {
          hitEnt.health = 10
        }
        killEnt(this)
      }
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
    animationType: '',
    animationTick: 0,
    animationStop: 20,
    rotation: 0,
    degreesPerTick: 1,
    expansionPerTick: pos2d(1, 1),
    update() {
      if (this.targetEnt) {
        snapEnt2Ent(this, this.snapPoint, this.targetEnt, this.targetSnapPoint)
      }
      if (this.animationType.includes('expand')) {
        this.size = addPos(this.size, this.expansionPerTick)
      }
      if (this.animationType.includes('rotate')) {
        this.rotation += this.degreesPerTick
        this.rotation = this.rotation >= 360 ? this.rotation - 360 : this.rotation
        this.rotation = this.rotation <= 0 ? 360 - this.rotation : this.rotation
      }
      this.animationTick += 1
      if (this.animationTick > this.animationStop) {
        killEnt(this)
      }
    },
  },
  ASTEROID: {
    name: 'asteroid',
    type: 'asteroid',
    pos: pos2d(0, 0),
    size: pos2d(33, 33),
    depth: -5,
    color: 'red',
    img: 'img/asteroid.png',
    rotation: 0,
    degreesPerTick: 1,
    health: 10,
    onCreation() {
      const size = randInt(33, 70)
      this.size = pos2d(size, size)
      this.degreesPerTick = randInt(-3, 3)
    },
    onCollision(hitEnt) {
      if (['player', 'enemy'].includes(hitEnt.type)) {
        hitEnt.health -= 10
        killEnt(this)
      }
    },
    onDestroy() {
      addExplosion(this)
    },
    update() {
      this.rotation += this.degreesPerTick
      this.rotation = this.rotation >= 360 ? this.rotation - 360 : this.rotation
      this.rotation = this.rotation <= 0 ? 360 - this.rotation : this.rotation

      translateEntInDir(this, 'down')

      if (this.health <= 0) { killEnt(this) }
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
  HUD: '#333333',
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

function handleCollisions() {
  checkCollisions()
  // addDebugText('ENTS', ENTS.map((ent) => { return ent.name }).filter((name) => { return name !== 'star' }))
  EVENTS[EVENT_TYPES.COLLISIONS].forEach((collision) => {
    const entList = collision.entList
    if (!Array.isArray(entList) || entList.length !== 2) return // skip if invalid
    
    const entA = entList[0]
    const entB = entList[1]
    
    if ('onCollision' in entA) { entA.onCollision(entB) }
    if ('onCollision' in entB) { entB.onCollision(entA) }
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
  return ENTS.find((ent) => ent.name === entName) || {}
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
    if ('update' in ent) {
      ent.update()
    }
  })
}

function applyInheritance(ent) {
  if (!('inheritFrom' in ent)) return
  ent.inheritFrom.forEach((ancestorName) => {
    const ancestor = ENT_TYPES[ancestorName]
    updateObjProps(ent, ancestor, 'overwrite')
  })
}

function createEnt(prototype, customProps = {}) {
  const newEnt = {...prototype}
  applyInheritance(newEnt)
  updateObjProps(newEnt, customProps, 'overwrite')
  if ('onCreation' in newEnt) { newEnt.onCreation() }
  ENTS.push(newEnt)
  return newEnt
}

function addExplosion(targetEnt = null, pos = pos2d(0, 0)) {
  createEnt(ENT_TYPES.SPRITE, {
    pos: pos,
    size: pos2d(3, 3),
    targetEnt: targetEnt,
    animationStop: 37,
    expansionPerTick: pos2d(1.33, 1.33),
    degreesPerTick: randInt(-2, 2),
    animationType: 'expand & rotate',
    img: 'img/explosion.png'
  })
}

function drawBackground() {
  ctx.fillStyle = COLORS.BG
  ctx.fillRect(0, 0, mainCanvas.width, mainCanvas.height)
}

function drawText(pos, text, font, color) {
  ctx.font = font
  ctx.fillStyle = color
  ctx.fillText(text, pos.x, pos.y)
}

function drawTextWithShadow(pos, offset, text, font, color, shadowColor) {
  drawText(addPos(pos, offset), text, font, shadowColor)  
  drawText(pos, text, font, color)
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

function applyRotation(ent) {
  if (!('rotation' in ent)) return // abort if rotation not needed

  const transform = {
    angle: deg2rad(ent.rotation),
    pivot: getRectSnapPoints(ent).center,
    originalRect: { pos: ent.pos, size: ent.size }
  }
  ctx.translate(transform.pivot.x, transform.pivot.y)
  ctx.rotate(transform.angle)
  snapEnt2Ent(ent, 'center', rect2d(pos2d(0, 0), pos2d(1, 1)), 'NW')

  return transform
}

function undoRotation(ent, transform) {
  if (!transform) return // abort if rotation not needed

  ctx.setTransform(1,0,0,1,0,0) // reset rotation & translation to default
  // ctx.rotate(transform.angle * -1)
  // ctx.translate(transform.pivot.x * -1, transform.pivot.y * -1)
  snapEnt2Ent(ent, 'center', transform.originalRect, 'center')
}

function drawEnt(ent) {
  const transform = applyRotation(ent)
  
  if('img' in ent) {
    drawImg(ent)
  } else if ('color' in ent) {
    drawRect(ent)
  }

  undoRotation(ent, transform)
}

function drawEnts() {
  ENTS.sort((a, b) => a.depth - b.depth)
  ENTS.forEach((ent) => {
    drawEnt(ent)
  })
}

function drawStats() {
  ctx.fillStyle = COLORS.HUD
  ctx.fillRect(0, 0, GAME.VIEW_WIDTH, 33)

  const playerEnt = getEnt('PLAYER')
  const currentHealth = playerEnt.health && playerEnt.health >= 0 ? playerEnt.health : 0
  const shieldText = `Shields: ${'|'.repeat(currentHealth)}`
  const shieldTextColor = currentHealth > 3 ? '#007700' : 'red'
  drawTextWithShadow(pos2d(5, 20), pos2d(1, 1), shieldText, '15px monospace', shieldTextColor, '#fff')
}

function drawScene() {
  drawBackground()
  drawEnts()
  drawStats()
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
    const entType = randItem(['ENEMY', 'ASTEROID'])
    createEnt(ENT_TYPES[entType], { pos: pos2d(randX, 0) })
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

// const gameSpeedDebugger = newElement({
//   tag: 'input',
//   type: 'range',
//   value: '1',
//   min: '1',
//   max: '100',
// })

// gameSpeedDebugger.addEventListener('input', () => {
//   GAME.SLOW_DOWN = gameSpeedDebugger.value
// })

// const inputDebugger = newElement({
//   tag: 'h1'
// })

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
    // inputDebugger.textContent = Object.keys(this.STATUS).map((key) => {
    //   return `\n${key}: ${this.STATUS[key]}`
    // })
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


const canvasContainer = getElement('canvasContainer')
canvasContainer.style.position = 'relative'
const rect = canvasContainer.getBoundingClientRect()

const cursor = newElement({
  parent: canvasContainer,
  style: {
    zIndex: 3,
    height: '33px',
    width: '33px',
    // backgroundColor: 'blue',
    position: 'absolute',
  }
})

const cursorEnt = createEnt({
  pos: pos2d(0, 0),
  size: pos2d(3, 3),
  color: 'aqua',
  onCollision(hitEnt) {
    addDebugText('cursor-hit', hitEnt.type)
    addDebugText('cursor-pos', this.pos)
  },
})

document.addEventListener('mousemove', (event) => {
  // const mousePos = pos2d(event.clientX + rect.left, event.clientY - rect.top)
  const mousePos = pos2d(event.clientX - rect.left, event.clientY - rect.top)
  // const mousePos = pos2d(event.clientX, event.clientY)
  // addDebugText('meh', `${event.clientX - rect.left}, ${event.clientY - rect.top}`)
  addDebugText('meh', `${mousePos.x}, ${mousePos.y}`)
  cursor.style.left = `${mousePos.x}px`
  cursor.style.top = `${mousePos.y}px`
  cursorEnt.pos = mousePos
})