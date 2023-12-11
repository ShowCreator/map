import * as THREE from 'three';
import ThreeBase from './ThreeBase.ts';
import * as TWEEN from '@tweenjs/tween.js'

export class MyEarth extends ThreeBase {
  constructor() {
    console.log('22');
    
    super();
    this.initCameraPos = [0, 0, 10];
    // this.isAxis = true;
    this.barMin = 0.01;
    this.barMax = 0.5;
    this.currentBarH = 0.01;
  }
  animateAction() {
    TWEEN.update();
  }

  drawEarthTex() {
    let that = this.that;
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


  addBar(i, lon, lat, value) {
    const { lonHelper, latHelper, positionHelper, originHelper } = this;
    const amount = (value - this.min) / this.range;

    const hue = THREE.MathUtils.lerp(this.that.barHueStart, this.that.barHueEnd, amount);
    const saturation = 1;
    const lightness = THREE.MathUtils.lerp(
      this.that.barLightStart,
      this.that.barLightEnd,
      amount
    );
    const color = new THREE.Color();
    color.setHSL(hue, saturation, lightness);
    this.mesh.setColorAt(i, color);

    lonHelper.rotation.y = THREE.MathUtils.degToRad(lon) + Math.PI * 0.5;
    latHelper.rotation.x = THREE.MathUtils.degToRad(-lat);

    positionHelper.updateWorldMatrix(true, false);

    positionHelper.scale.set(0.01, 0.01, THREE.MathUtils.lerp(0.01, 0.5, amount));
    originHelper.updateWorldMatrix(true, false);

    this.mesh.setMatrixAt(i, originHelper.matrixWorld);
  }

  createChart(that) {
    this.camera.near = 0.01;
    this.camera.updateProjectionMatrix();

    this.that = that;
    this.drawEarthTex().then((canvas) => {
      const map = new THREE.CanvasTexture(canvas);
      map.wrapS = THREE.RepeatWrapping;
      map.wrapT = THREE.RepeatWrapping;
      const geometry = new THREE.SphereGeometry(1, 32, 32);
      const material = new THREE.MeshBasicMaterial({ map: map, transparent: true });
      const sphere = new THREE.Mesh(geometry, material);
      this.scene.add(sphere);
      this.lonHelper = new THREE.Object3D();
      this.scene.add(this.lonHelper);
      this.latHelper = new THREE.Object3D();
      this.lonHelper.add(this.latHelper);

      this.positionHelper = new THREE.Object3D();
      this.positionHelper.position.z = 1;
      this.latHelper.add(this.positionHelper);

      this.originHelper = new THREE.Object3D();
      this.originHelper.position.z = 0.5;
      this.positionHelper.add(this.originHelper);

      this.min = Number.MAX_SAFE_INTEGER;
      this.max = Number.MIN_SAFE_INTEGER;
      this.boxGeometry = new THREE.BoxGeometry(1, 1, 1);

      this.boxMaterial = new THREE.MeshBasicMaterial({ color: '#FFFFFF' });
      // fetch('../../mock/earthquake.json')
      //   .then((res) => res.json())
      //   .then((res) => {
        const res  =require('../../mock/earthquake.json')
        res.forEach((a) => {
          if (this.min > a.mag) {
            this.min = a.mag;
          }
          if (this.max < a.mag) {
            this.max = a.mag;
          }
        });
        this.range = this.max - this.min;
        this.mesh = new THREE.InstancedMesh(this.boxGeometry, this.boxMaterial, res.length);
        this.scene.add(this.mesh);
        res.forEach((a, i) => {
          this.addBar(i, a.lon, a.lat, a.mag);
        });
        this.mesh.instanceColor.needsUpdate = true;
        this.mesh.instanceMatrix.needsUpdate = true;
        }).catch(e => {
          console.log('e: ', e);
        })
    // });
  }
  addBars(res) {
    res.forEach((a, i) => {
      this.addBar(i, a.lon, a.lat, a.mag);
    });
    this.mesh.instanceColor.needsUpdate = true;
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}
