import * as THREE from 'three'
import * as d3 from 'd3'
import TWEEN from '@tweenjs/tween.js'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { LightProbeGenerator } from 'three/examples/jsm/lights/LightProbeGenerator.js'

import { CSM } from 'three/examples/jsm/csm/CSM.js'
import { CSMHelper } from 'three/examples/jsm/csm/CSMHelper.js'

import px from '../../textures/cube/px.png'
import py from '../../textures/cube/py.png'
import pz from '../../textures/cube/pz.png'
import nx from '../../textures/cube/nx.png'
import ny from '../../textures/cube/ny.png'
import nz from '../../textures/cube/nz.png'

import tag from '../../textures/tag.png'
import { DillMap } from '../DillMap/DillMap'

// 墨卡托投影转换
const projection = d3.geoMercator().center([104.0, 37.5]).scale(80).translate([0, 0])

// 地图材质颜色
const COLOR_ARR = ['#4350C1', '#008495', '#0465BD', '#357bcb', '#408db3']

let csmHelper: any
const params = {
  orthographic: false,
  fade: false,
  far: 1000,
  mode: 'practical',
  // mode: 'uniform',
  lightX: -1,
  lightY: -1,
  lightZ: -1,
  margin: 100,
  lightFar: 5000,
  lightNear: 1,
  autoUpdateHelper: true,
  updateHelper: function () {
    csmHelper.update()
  },
}

export class MapThree {
  public container: HTMLDivElement
  public provinceInfo: HTMLDivElement
  public width: number
  public height: number
  public group: THREE.Object3D<THREE.Object3DEventMap> | null
  public controller: OrbitControls
  public renderer: THREE.WebGLRenderer
  public scene: THREE.Scene
  public lightProbe: THREE.LightProbe
  public camera: THREE.PerspectiveCamera
  public csm: CSM
  public csmHelper: CSMHelper<any>
  public map: THREE.Object3D<THREE.Object3DEventMap>
  public raycaster: THREE.Raycaster
  public mouse: THREE.Vector2
  public eventOffset: any = {}
  public selectedObject: any
  public activeInstersect: any
  public dillMapIns: DillMap

  constructor(container, el) {
    this.container = container ? container : document.body
    this.width = this.container.offsetWidth
    this.height = this.container.offsetHeight
    this.provinceInfo = el
    this.group = null

    this.dillMapIns = new DillMap()
  }

  async init() {
    const geoJson = await this.dillMapIns.loadMapGeoJson(require('@/geoJsonFile/100000.geoJson'))
    this.provinceInfo = this.provinceInfo || document.getElementById('provinceInfo')
    this.group = new THREE.Object3D() // 标注

    this.selectedObject = null
    // 渲染器
    // this.renderer = new THREE.WebGLRenderer();
    if (!this.renderer) {
      this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    }
    this.renderer.shadowMap.enabled = true // 开启阴影
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.25
    // this.renderer.outputEncoding = THREE.sRGBEncoding;
    // this.renderer.outputColorSpace = THREE.sRGBEncoding
    this.renderer.setPixelRatio(window.devicePixelRatio)
    // 清除背景色，透明背景
    this.renderer.setClearColor(0xffffff, 0)

    this.renderer.setSize(this.width, this.height)
    this.container.appendChild(this.renderer.domElement)

    // 场景
    this.scene = new THREE.Scene()
    this.scene.background = null

    // probe
    this.lightProbe = new THREE.LightProbe()

    // this.scene.add(bulbLight)
    this.scene.add(this.lightProbe)

    // 相机 透视相机
    this.camera = new THREE.PerspectiveCamera(45, this.width / this.height, 0.1, 5000)
    this.camera.position.set(0, -40, 70)
    this.camera.lookAt(0, 0, 0)

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5)
    this.scene.add(ambientLight)

    this.csm = new CSM({
      maxFar: params.far,
      cascades: 4,
      mode: params.mode,
      parent: this.scene,
      shadowMapSize: 1024,
      lightDirection: new THREE.Vector3(params.lightX, params.lightY, params.lightZ).normalize(),
      camera: this.camera,
    })

    this.csmHelper = new CSMHelper(this.csm)
    this.csmHelper.visible = false
    this.scene.add(this.csmHelper)

    const axesHelper = new THREE.AxesHelper(30)
    this.scene.add(axesHelper)

    this.setController() // 设置控制

    this.setLight() // 设置灯光

    // this.setPlayGround()

    // await this.initMap(geoJson)
    const canvas = await this.initEarth()
    const map = new THREE.CanvasTexture(canvas);
    map.wrapS = THREE.RepeatWrapping;
    map.wrapT = THREE.RepeatWrapping;
    const geometry = new THREE.SphereGeometry(20, 32, 32);
    const material = new THREE.MeshBasicMaterial({ map: map, transparent: true });
    const sphere = new THREE.Mesh(geometry, material);
    this.scene.add(sphere);
    // this.setTag()
  }

  initMap(chinaJson: any) {
    // 建一个空对象存放对象
    this.map = new THREE.Object3D()

    const _this = this

    // 加载贴图材质
    const urls = [px, nx, py, ny, pz, nz]

    return new Promise<void>((resolve, reject) => {
      // 绘制地图
      new THREE.CubeTextureLoader().load(
        urls,
        function (cubeTexture) {
          // cubeTexture.encoding = THREE.sRGBEncoding;
          // _this.scene.background = cubeTexture;

          _this.lightProbe.copy(LightProbeGenerator.fromCubeTexture(cubeTexture))

          chinaJson.features.forEach((elem, index) => {
            // 定一个省份3D对象
            const province = new THREE.Object3D()
            // 每个的 坐标 数组
            const coordinates = elem.geometry.coordinates
            const color = COLOR_ARR[index % COLOR_ARR.length]

            // 循环坐标数组
            coordinates.forEach((multiPolygon: any) => {
              multiPolygon.forEach((polygon: any) => {
                const shape = new THREE.Shape()
                for (let i = 0; i < polygon.length; i++) {
                  let [x, y] = projection(polygon[i])
                  if (isNaN(x) || isNaN(y)) {
                    continue
                  }
                  if (i === 0) {
                    shape.moveTo(x, -y)
                  }
                  shape.lineTo(x, -y)
                }

                const extrudeSettings = {
                  depth: 2,
                  bevelEnabled: true,
                  bevelSegments: 1,
                  bevelThickness: 0.2,
                }

                const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings)

                const material = new THREE.MeshStandardMaterial({
                  metalness: 1,
                  color: color,
                })

                const material1 = new THREE.MeshStandardMaterial({
                  metalness: 1,
                  roughness: 1,
                  color: color,
                })

                const mesh = new THREE.Mesh(geometry, [material, material1])
                if (index % 2 === 0) {
                  mesh.scale.set(1, 1, 1.1)
                }

                mesh.castShadow = true
                mesh.receiveShadow = true
                mesh._color = color
                mesh._properties = elem.properties
                province.add(mesh)
              })
            })

            // 将geo的属性放到省份模型中
            province.properties = elem.properties
            if (elem.properties.centroid) {
              const [x, y] = projection(elem.properties.centroid)
              province.properties._centroid = [x, y]
            }

            _this.map.add(province)
          })

          _this.scene.environment = cubeTexture
          // 销毁贴图
          cubeTexture.dispose()
          _this.scene.add(_this.map)
          // this.renderer.render();
          resolve()
        },
        () => null,
        (e) => {
          console.log(e)
          reject(e)
        },
      )
    })
  }

  // 绘制标注
  setTag(_data = []) {
    if (!_data || _data.length === 0) {
      return
    }

    this.scene.remove(this.group)
    this.group = new THREE.Object3D()

    function paintTag(scale = 1) {
      const spriteMap = new THREE.TextureLoader().load(tag)

      _data.forEach((d) => {
        // 必须是不同的材质，否则鼠标移入时，修改材质会全部都修改
        const spriteMaterial = new THREE.SpriteMaterial({ map: spriteMap, color: 0xffffff })
        const { value } = d as any
        // 添加标点
        const sprite1 = new THREE.Sprite(spriteMaterial)

        if (value && value.length !== 0) {
          let [x, y] = projection(value)
          sprite1.position.set(x, -y + 2, 6)
        }
        sprite1._data = d
        sprite1.scale.set(2 * scale, 3 * scale, 8 * scale)

        this.group.add(sprite1)
      })
      spriteMap.dispose()
    }

    function setScale(scale = 1) {
      this.group.children.forEach((s) => {
        s.scale.set(2 * scale, 3 * scale, 8 * scale)
      })
    }

    this.scene.add(this.group)

    paintTag.call(this, 0.1)

    const tween = new TWEEN.Tween({ val: 0.1 })
      .to(
        {
          val: 1.2,
        },
        1.5 * 1000,
      )
      .easing(TWEEN.Easing.Quadratic.InOut)
      .onUpdate((d) => {
        //高度增加动画
        setScale.call(this, d.val)
      })
    tween.start()

    if (this.raycaster) {
      this.raycaster.setFromCamera(this.mouse, this.camera)
    }
    this.renderer.render(this.scene, this.camera)
    console.log('render info', this.renderer.info)
    // TWEEN.update()
  }

  // // 绘制地面
  setPlayGround() {
    const groundMaterial = new THREE.MeshStandardMaterial({
      color: 0x031837,
      // specular: 0x111111,
      metalness: 0,
      roughness: 1,
      // opacity: 0.2,
      opacity: 0.5,
      transparent: true,
    })
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(2000, 2000, 1, 1), groundMaterial)
    // ground.rotation.x = - Math.PI / 2;
    ground.position.z = 0
    // ground.castShadow = true;
    ground.receiveShadow = true

    this.scene.add(ground)
  }

  setLight() {
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.2) // 环境光

    const light = new THREE.DirectionalLight(0xffffff, 0.5) // 平行光
    light.position.set(20, -50, 20)

    light.castShadow = true
    light.shadow.mapSize.width = 1024
    light.shadow.mapSize.height = 1024

    // 半球光
    const hemiLight = new THREE.HemisphereLight('#80edff', '#75baff', 0.3)
    // 这个也是默认位置
    hemiLight.position.set(20, -50, 0)
    this.scene.add(hemiLight)

    const pointLight = new THREE.PointLight(0xffffff, 0.5)
    pointLight.position.set(20, -50, 50)

    pointLight.castShadow = true
    pointLight.shadow.mapSize.width = 1024
    pointLight.shadow.mapSize.height = 1024

    const pointLight2 = new THREE.PointLight(0xffffff, 0.5)
    pointLight2.position.set(50, -50, 20)
    pointLight2.castShadow = true
    pointLight2.shadow.mapSize.width = 1024
    pointLight2.shadow.mapSize.height = 1024

    const pointLight3 = new THREE.PointLight(0xffffff, 0.5)
    pointLight3.position.set(-50, -50, 20)
    pointLight3.castShadow = true
    pointLight3.shadow.mapSize.width = 1024
    pointLight3.shadow.mapSize.height = 1024

    this.scene.add(ambientLight)
    this.scene.add(light)
    this.scene.add(pointLight)
    this.scene.add(pointLight2)
    this.scene.add(pointLight3)
  }

  setController() {
    this.controller = new OrbitControls(this.camera, this.renderer.domElement)
    this.controller.update()
    /* this.controller.enablePan = false; // 禁止右键拖拽

        this.controller.enableZoom = true; // false-禁止右键缩放
        
        this.controller.maxDistance = 200; // 最大缩放 适用于 PerspectiveCamera
        this.controller.minDistance = 50; // 最大缩放

        this.controller.enableRotate = true; // false-禁止旋转 */

    /* this.controller.minZoom = 0.5; // 最小缩放 适用于OrthographicCamera
        this.controller.maxZoom = 2; // 最大缩放 */
  }

  createProvinceInfo() {
    // 显示省份的信息
    if (
      this.activeInstersect.length !== 0 &&
      this.activeInstersect[0].object.parent.properties.name
    ) {
      const properties = this.activeInstersect[0].object.parent.properties

      this.provinceInfo.textContent = properties.name

      this.provinceInfo.style.visibility = 'visible'
    } else {
      this.provinceInfo.style.visibility = 'hidden'
    }
  }

  initEarth() {
    let that = {
      bg: 'rgb(10 ,20 ,28)',
      borderColor: 'rgb(10 ,20 ,28)',
      blurColor: '#000000',
      borderWidth: 2,
      blurWidth: 0,
      fillColor: 'rgb(26, 35, 44)',

      // bg: '#000080',
      // borderColor: '#1E90FF',
      // blurColor: '#1E90FF',
      // borderWidth: 1,
      // blurWidth: 5,
      // fillColor: 'rgb(30 ,144 ,255,0.3)',

      barHueStart: 0.7,
      barHueEnd: 0.2,
      barLightStart: 0.1,
      barLightEnd: 1.0,
      cameraPos: {
        x: 0.27000767404584447,
        y: 1.0782003329514755,
        z: 3.8134631736522793,
      },
      controlPos: {
        x: 0,
        y: 0,
        z: 0,
      },
    }
    return new Promise((resolve) => {
      function drawRegion(ctx, c, geoInfo) {
        ctx.beginPath();
        c.forEach((item, i) => {
          let pos = [(item[0] + 180) * 10, (-item[1] + 90) * 10];
          if (i == 0) {
            ctx.moveTo(pos[0], pos[1]);
          } else {
            ctx.lineTo(pos[0], pos[1]);
          }
        });
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
      fetch(require('../../geoJsonFile/world.zh.geoJson'))
        .then((res) => res.json())
        .then((geojson) => {
          console.log('geojson: ', geojson);
          let canvas = document.createElement('canvas');

          canvas.width = 3600;
          canvas.height = 1800;

          let ctx = canvas.getContext('2d');
          ctx.fillStyle = that.bg;
          ctx.rect(0, 0, canvas.width, canvas.height);
          ctx.fill();
          //设置地图样式
          ctx.strokeStyle = that.borderColor;
          ctx.lineWidth = that.borderWidth;

          ctx.fillStyle = that.fillColor;
          if (that.blurWidth) {
            ctx.shadowBlur = that.blurWidth;
            ctx.shadowColor = that.blurColor;
          }

          geojson.features.forEach((a) => {
            if (a.geometry.type == 'MultiPolygon') {
              a.geometry.coordinates.forEach((b) => {
                b.forEach((c) => {
                  drawRegion(ctx, c);
                });
              });
            } else {
              a.geometry.coordinates.forEach((c) => {
                drawRegion(ctx, c);
              });
            }
          });
          resolve(canvas);
        }).catch(e => {
          console.log('e: ', e);
        })
    });
  }
}
