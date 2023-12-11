import * as THREE from 'three'
import { MapThree } from '../MapThree/MapThree'
import TWEEN from '@tweenjs/tween.js'

let animationId: any = null
const HIGHT_COLOR = 'red'

export class Mstandard extends MapThree {
  constructor(container, el) {
    super(container, el)
  }

  async draw() {
    await this.init()
    this.setRaycaster()

    this.container.addEventListener('mouseenter', this.startAnimation.bind(this))
    this.container.addEventListener('mouseleave', this.stopAnimation.bind(this))
    window.addEventListener('resize', this.resizeEventHandle.bind(this))
  }

  setRaycaster() {
    this.raycaster = new THREE.Raycaster()
    this.mouse = new THREE.Vector2()
    this.eventOffset = {}
    const _this = this

    function onMouseMove(event) {
      // 父级并非满屏，所以需要减去父级的left 和 top
      let { top, left, width, height } = _this.container.getBoundingClientRect()
      const clientX = event.clientX - left
      const clientY = event.clientY - top

      _this.mouse.x = (clientX / width) * 2 - 1
      _this.mouse.y = -(clientY / height) * 2 + 1

      _this.eventOffset.x = clientX
      _this.eventOffset.y = clientY
      _this.provinceInfo.style.left = _this.eventOffset.x + 10 + 'px'
      _this.provinceInfo.style.top = _this.eventOffset.y - 20 + 'px'
    }

    // 标注
    function onPointerMove() {
      if (_this.selectedObject) {
        _this.selectedObject.material.color.set(0xffffff)
        _this.selectedObject = null
      }

      if (_this.raycaster) {
        const intersects = _this.raycaster.intersectObject(_this.group, true)
        // console.log('select group', intersects)
        if (intersects.length > 0) {
          const res = intersects.filter(function (res) {
            return res && res.object
          })[intersects.length - 1]

          if (res && res.object) {
            _this.selectedObject = res.object
            _this.selectedObject.material.color.set('#f00')
          }
        }
      }
    }

    // 标注点击
    function onClick() {
      if (_this.selectedObject) {
        // 输出标注信息
        console.log(_this.selectedObject._data)
      }
    }

    // 在鼠标点击事件中进行射线拾取
    function onDrillDown(event) {
      // 检测射线与场景中的物体相交
      const intersects = _this.raycaster.intersectObjects(_this.map.children, true)

      // 处理相交结果
      if (intersects.length > 0) {
        // 获取第一个相交物体
        const intersectedObject = intersects[0].object
        _this.dillMapIns
          .handleDrillDown({ properties: intersectedObject._properties })
          .then((res) => {
            _this.scene.remove(_this.group)
            _this.scene.remove(_this.map)
            _this.initMap(res).then(() => {
              _this.updateCamera(_this.map)
            })
          })
      }
    }
    document.addEventListener('mousemove', onMouseMove, false)
    document.addEventListener('pointermove', onPointerMove)
    document.addEventListener('click', onClick)
    window.addEventListener('click', onDrillDown, false)
  }
  animate() {
    animationId = requestAnimationFrame(this.animate.bind(this))
    if (this.raycaster) {
      this.raycaster.setFromCamera(this.mouse, this.camera)

      // calculate objects intersecting the picking ray
      const intersects: any = this.raycaster.intersectObjects(this.scene.children, true)
      if (this.activeInstersect && this.activeInstersect.length > 0) {
        // 将上一次选中的恢复颜色
        this.activeInstersect.forEach((element) => {
          const { object } = element
          const { _color, material } = object
          material[0].color.set(_color)
          material[1].color.set(_color)
        })
      }

      this.activeInstersect = [] // 设置为空
      // console.log('select', intersects)
      for (let i = 0; i < intersects.length; i++) {
        // debugger;
        if (intersects[i].object.material && intersects[i].object.material.length === 2) {
          this.activeInstersect.push(intersects[i])
          intersects[i].object.material[0].color.set(HIGHT_COLOR)
          intersects[i].object.material[1].color.set(HIGHT_COLOR)
          break // 只取第一个
        }
      }
    }
    this.createProvinceInfo()
    this.camera.updateMatrixWorld()
    this.csm.update()
    this.controller.update()
    // csmHelper.update();
    if (!this.renderer) {
      this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    }
    this.renderer.render(this.scene, this.camera)
    TWEEN.update()
  }
  // 丢失 context
  destroy() {
    if (this.renderer) {
      this.renderer.forceContextLoss()
      this.renderer.dispose()
      this.renderer.domElement = null
      this.renderer = null
    }
    this.container.removeEventListener('mouseenter', this.startAnimation.bind(this))
    this.container.removeEventListener('mouseleave', this.stopAnimation.bind(this))
    window.removeEventListener('resize', this.resizeEventHandle)
  }

  resizeEventHandle() {
    this.width = this.container.offsetWidth
    this.height = this.container.offsetHeight
    this.renderer.setSize(this.width, this.height)
  }

  startAnimation() {
    if (!animationId) {
      animationId = requestAnimationFrame(this.animate.bind(this))
    }
  }

  stopAnimation() {
    if (animationId) {
      cancelAnimationFrame(animationId)
      animationId = null
    }
  }
  updateCamera(obj: THREE.Object3D) {
    const mapBox = new THREE.Box3().setFromObject(obj)
    const mapBoxSize = mapBox.getSize(new THREE.Vector3()).length()
    const boxCenter = mapBox.getCenter(new THREE.Vector3())

    // 这个函数官方案例有，可以自己去案例里搜索，简单讲就是根据物体大小计算相机与物体的距离，调整相机到适合观察物体的距离
    this.frameArea(mapBoxSize * 0.9, mapBoxSize, boxCenter)
  }

  frameArea(sizeToFitOnScreen: number, boxSize: number, boxCenter: THREE.Vector3) {
    const halfSizeToFitOnScreen = sizeToFitOnScreen * 0.5
    const halfFovY = THREE.MathUtils.degToRad(this.camera.fov * 0.5)
    const distance = halfSizeToFitOnScreen / Math.tan(halfFovY)
    // compute a unit vector that points in the direction the camera is now
    // in the xz plane from the center of the box
    const direction = new THREE.Vector3()
      .subVectors(this.camera.position, boxCenter)
      .multiply(new THREE.Vector3(0, 0, 1))
      .normalize()

    // move the camera to a position distance units way from the center
    // in whatever direction the camera was from the center already
    this.camera.position.copy(direction.multiplyScalar(distance).add(boxCenter))

    // pick some near and far values for the frustum that
    // will contain the box.
    this.camera.near = boxSize / 100
    this.camera.far = boxSize * 100

    this.camera.updateProjectionMatrix()

    this.controller.target = boxCenter
    this.controller.update()
    // point the camera to look at the center of the box
    this.camera.lookAt(boxCenter.x, boxCenter.y, boxCenter.z)
  }
}
