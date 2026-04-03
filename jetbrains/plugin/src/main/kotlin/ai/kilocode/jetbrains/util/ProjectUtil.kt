// SPDX-FileCopyrightText: 2025 Weibo, Inc.
//
// SPDX-License-Identifier: Apache-2.0

package ai.kilocode.jetbrains.util

import com.intellij.openapi.project.Project
import java.io.File

/**
 * Utility class for project related operations
 */
object ProjectUtil {
    private val BAZEL_PROJECT_DIR_SUFFIXES = listOf(".ijwb", ".clwb", ".aswb")

    /**
     * Get the effective project base path.
     * If the project is a Bazel project (imported via the IntelliJ Bazel plugin),
     * the project root might be set to a subdirectory like .ijwb.
     * This method returns the parent directory in such cases.
     *
     * @param project The project
     * @return The absolute path to the project root, or null if project has no base path
     */
    fun getEffectiveProjectRoot(project: Project): String? {
        val basePath = project.basePath ?: return null
        
        val file = File(basePath)
        if (BAZEL_PROJECT_DIR_SUFFIXES.contains(file.name)) {
            return file.parent ?: basePath
        }
        
        return basePath
    }
}
