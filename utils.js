const deepClone = obj => JSON.parse(JSON.stringify(obj));

function isObject(variable) {
  return (
    typeof variable === 'object' &&
    variable !== null &&
    !Array.isArray(variable)
  )
}

function styleObjectToString(styles) {
  return Object.entries(styles).reduce((acc, [key, value]) => {
      // Convert camelCase to kebab-case for CSS properties
      const cssKey = key.replace(/([A-Z])/g, '-$1').toLowerCase();
      return acc + `${cssKey}: ${value}; `;
  }, '').trim();
}

function parseStyleString(styleString) {
  const styleObj = {}
  styleString = styleString.replace(/: +/g, ':')
  styleString = styleString.replace(/; +/g, ';')
  const propValStrings = styleString.split(';')
  propValStrings.forEach((propValString) => {
    if (propValString.includes(':')) {
      const pair = propValString.split(':')
      styleObj[pair[0]] = pair[1]
    }
  })

  return styleObj
}

function parseClassString(classString) {
  if(Array.isArray(classString)) {
    return classString
  }
  classString = classString.replace(/,/g, ' ')
  classString = classString.replace(/ +/g, ' ')
  return classString.split(' ')
}

function addProperty(keyName, destObj, donorObj) {
	if(!destObj.hasOwnProperty(keyName)) {
  	destObj[keyName] = donorObj[keyName]
  }

  return destObj[keyName] === donorObj[keyName] ? "success" : "failure";
}

function removeProperty(keyName, destObj) {
	if(destObj.hasOwnProperty(keyName)) {
  	delete destObj[keyName]
  }

  return !destObj.hasOwnProperty(keyName) ? "success" : "failure";
}

function overwriteProperty(keyName, destObj, donorObj) {
  destObj[keyName] = donorObj[keyName]

  return destObj[keyName] === donorObj[keyName] ? "success" : "failure";
}

function toggleProperty(keyName, destObj, donorObj) {
	let result
  if(destObj.hasOwnProperty(keyName)) {
  	const wasRemoved = removeProperty(keyName, destObj)
  	result = wasRemoved === "success" ? "removed" : "failure";
  } else {
  	const wasAdded = addProperty(keyName, destObj, donorObj)
    result = wasAdded === "success" ? "added" : "failure";
  }

  return result
}

const updateObjProp = {
	add: (keyName, destObj, donorObj) => {
  	return addProperty(keyName, destObj, donorObj)
  },
  remove: (keyName, destObj, donorObj) => {
  	return removeProperty(keyName, destObj, donorObj)
  },
  overwrite: (keyName, destObj, donorObj) => {
  	return overwriteProperty(keyName, destObj, donorObj)
  },
  toggle: (keyName, destObj, donorObj) => {
  	return toggleProperty(keyName, destObj, donorObj)
  },
}

function updateObjProps(destObj, donorObj, mode='overwrite') {
  let objKeys
  if (isObject(donorObj)) {
    objKeys = Object.keys(donorObj)
  } else if (Array.isArray(donorObj) && ['remove'].includes(mode)) {
    objKeys = donorObj
  } else {
    return
  }
  objKeys.forEach((keyName) => {
    updateObjProp[mode](keyName, destObj, donorObj)
  })
}

const updateCssClass = {
  add: (className, domElement) => {
    domElement.classList.add(className)
  },
  remove: (className, domElement) => {
    domElement.classList.remove(className)
  },
  toggle: (className, domElement) => {
    domElement.classList.toggle(className)
  },
}

function getElement(elem) {
  if (typeof elem === 'string') {
    elem = document.getElementById(elem)
  }
  return elem
}

function newElement(attrs = {}) {
  // determine which HTML tag to use for the new DOM element (<div> by default)
  const tag = attrs.hasOwnProperty("tag") ? attrs["tag"] : "div";
  const newElem = document.createElement(tag);
  return updateElement(newElem, attrs)
}

function updateElement(updateElem, attrs = {}) {
  updateElem = getElement(updateElem)
  // determine the parent element in which the new element should be nested (<body> by default)

  let parent
  if (attrs.hasOwnProperty("parent")) {
    parent = getElement(attrs.parent);
  } else if (updateElem.parentNode && updateElem.parentNode !== document.body) {
    parent = updateElem.parentNode
  } else {
    parent = document.body
  }
  parent.append(updateElem);

  // convert the style property to an HTML-friendly string if expressed as a JavaScript Object
  // e.g. { color: "black", fontSize: "13px" } ==> "color: black; font-size: 10px;"
  if (attrs.hasOwnProperty("style") && isObject(attrs.style)) {
    attrs.style = styleObjectToString(attrs.style);
  }
  // set innerText and/or innerHTML properties if specified
  if (attrs.hasOwnProperty("text")) { updateElem.innerText = attrs.text; }
  if (attrs.hasOwnProperty("html")) { updateElem.innerHTML = attrs.html; }

  // use one of four methods for updating CSS style props and classes:
  // "add", "remove", "toggle", and "overwrite" (styles only)
  if (attrs.hasOwnProperty("updateMode") && updateObjProp[attrs.updateMode]) {
    if (attrs.hasOwnProperty("style")) {
      const destStyle = parseStyleString(updateElem.getAttribute("style"))
      const donorStyle = parseStyleString(attrs.style)
      updateObjProps(destStyle, donorStyle, mode=attrs.updateMode)
      attrs.style = styleObjectToString(destStyle)
    }
    if (attrs.hasOwnProperty("class") && updateCssClass[attrs.updateMode]) {
      const newClasses = parseClassString(attrs.class)
      newClasses.forEach((className) => {
        updateCssClass[attrs.updateMode](className, updateElem)
      })
      delete attrs.class
    }
  }

  // remove keys from object that are not valid HTML tag attributes
  const nonHtmlAttrs = ["tag", "parent", "text", "html", "updateMode"];
  nonHtmlAttrs.forEach((key) => {
    delete attrs[key];
  });
  // add all other specified attributes to the new element
  for (const key in attrs) {
    updateElem.setAttribute(key, attrs[key]);
  }

  return updateElem
}

function toggleVisible(element, setVisible=null) {
  const e = getElement(element)
  if (setVisible === null) {
    e.style.visibility = e.style.visibility === "hidden" ? null : "hidden";
  } else {
    e.style.visibility = setVisible === true ? null : "hidden";
  }
}

const randInt = (min, max) => Math.floor(Math.random() * (max - min)) + min; // min: inc; max: exc
const randItem = (list) => list[randInt(0, list.length)];
const removeItemByValue = (arr, value) => arr.filter(item => item !== value);

function wrappedIndex(list, index, offset) {
  const targetIndex = index + offset
  const negative = targetIndex < 0
  const wrapped = Math.abs(targetIndex) % list.length
  return negative ? list.length - wrapped : wrapped
}

function itemByOffset(list, item, offset) {
  return list[wrappedIndex(list, list.indexOf(item), offset)]
}

function copyToClipboard(inputField, onSuccess=() => {console.log("Copied!")}) {
  inputField.select();
  try {
    document.execCommand('copy');
    onSuccess();
  } catch (err) {
    console.error('Unable to copy text', err);
  }
}

function fetchJSON(url, updateFunction) {
  fetch(url)
    .then(function (promise) {
      return promise.json();
    })
    .then(function (data) {
      updateFunction(data);
    })
    .catch(function (error) {
      console.error('Error:', error);
    });
}
