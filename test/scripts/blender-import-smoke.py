"""
Blender GLB Import Smoke Test

Usage:
    blender --background --python test/scripts/blender-import-smoke.py -- /path/to/model.glb

Exit codes:
    0: All checks passed
    1: Import failed
    2: Mesh structure invalid
    3: Material check failed
"""

import bpy
import sys
import math


def clear_scene():
    """씬 초기화"""
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)


def import_glb(filepath: str) -> bool:
    """GLB 파일 임포트"""
    try:
        bpy.ops.wm.gltf_import(filepath=filepath)
        return True
    except Exception as e:
        print(f"IMPORT_ERROR: {e}")
        return False


def check_mesh_structure() -> tuple[bool, str]:
    """메시 구조 검증"""
    mesh_objects = [obj for obj in bpy.data.objects if obj.type == 'MESH']
    if len(mesh_objects) == 0:
        return False, "No mesh objects found"
    
    for obj in mesh_objects:
        mesh = obj.data
        if len(mesh.vertices) == 0:
            return False, f"Mesh '{obj.name}' has no vertices"
        
        bbox = [obj.dimensions.x, obj.dimensions.y, obj.dimensions.z]
        for dim in bbox:
            if not math.isfinite(dim):
                return False, f"Mesh '{obj.name}' has non-finite bounding box dimension: {dim}"
        
        if all(d == 0 for d in bbox):
            return False, f"Mesh '{obj.name}' has zero bounding box (degenerate)"
    
    return True, f"OK: {len(mesh_objects)} meshes, {sum(len(o.data.vertices) for o in mesh_objects)} vertices"


def check_materials() -> tuple[bool, str]:
    """Material 검증"""
    mesh_objects = [obj for obj in bpy.data.objects if obj.type == 'MESH']
    materials_found = len(bpy.data.materials)
    unassigned = sum(1 for obj in mesh_objects if len(obj.material_slots) == 0)
    
    if unassigned > 0:
        return False, f"{unassigned} mesh objects have no material"
    
    return True, f"OK: {materials_found} materials, {len(mesh_objects)} objects"


def main():
    args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    if len(args) < 1:
        print("Usage: blender --background --python blender-import-smoke.py -- <glb_file>")
        sys.exit(1)
    
    filepath = args[0]
    
    clear_scene()
    
    if not import_glb(filepath):
        sys.exit(1)
    
    mesh_ok, mesh_msg = check_mesh_structure()
    print(f"MESH: {mesh_msg}")
    if not mesh_ok:
        sys.exit(2)
    
    mat_ok, mat_msg = check_materials()
    print(f"MATERIAL: {mat_msg}")
    if not mat_ok:
        sys.exit(3)
    
    print("ALL CHECKS PASSED")
    sys.exit(0)


if __name__ == '__main__':
    main()
