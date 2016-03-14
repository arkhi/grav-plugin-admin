import $ from 'jquery';
import { config } from 'grav-config';
import request from '../utils/request';

class Packages {

    static getBackToList(type) {
        window.location.href = `${config.base_url_relative}/${type}s`;
    }

    static addDependencyToList(type, dependency, slug = '') {
        let container = $('.package-dependencies-container');
        let text = `${dependency} <a href="#" class="button" data-dependency-slug="${dependency}" data-${type}-action="remove-dependency-package">Remove</a>`;

        if (slug) {
            text += ` (was needed by ${slug})`;
        }

        container.append(`<li>${text}</li>`);
    }

    addDependenciesToList(dependencies, slug = '') {
        dependencies.forEach((dependency) => {
            Packages.addDependencyToList('plugin', dependency, slug);
        });
    }

    static getTaskUrl(type, task) {
        let url = `${config.base_url_relative}`;
        url += `/${type}s.json`;
        url += `/task${config.param_sep}${task}`;
        return url;
    }

    static getRemovePackageUrl(type) {
        return `${Packages.getTaskUrl(type, 'removePackage')}`;
    }

    static getGetPackagesDependenciesUrl(type) {
        return `${Packages.getTaskUrl(type, 'getPackagesDependencies')}`;
    }

    static getInstallDependenciesOfPackagesUrl(type) {
        return `${Packages.getTaskUrl(type, 'installDependenciesOfPackages')}`;
    }

    static getInstallPackageUrl(type) {
        return `${Packages.getTaskUrl(type, 'installPackage')}`;
    }

    removePackage(type, slug) {
        let url = Packages.getRemovePackageUrl(type);

        request(url, {
            method: 'post',
            body: {
                package: slug
            }
        }, (response) => {
            if (response.status === 'success') {
                $('.remove-package-confirm').addClass('hidden');

                if (response.dependencies.length > 0) {
                    this.addDependenciesToList(response.dependencies);
                    $('.remove-package-dependencies').removeClass('hidden');
                } else {
                    $('.remove-package-done').removeClass('hidden');
                }

                // The package was removed. When the modal closes, move to the packages list
                $(document).on('closing', '[data-remodal-id="remove-package"]', () => {
                    Packages.getBackToList(type);
                });
            }
        });
    }

    removeDependency(type, slug, button) {
        let url = Packages.getRemovePackageUrl(type);

        request(url, {
            method: 'post',
            body: {
                package: slug
            }
        }, (response) => {
            if (response.status === 'success') {
                button.removeClass('button');
                button.replaceWith($('<span>capitalizefully</span>'));

                if (response.dependencies.length > 0) {
                    this.addDependenciesToList(response.dependencies, slug);
                }
            }
        });
    }

    static addNeededDependencyToList(type, dependency) {
        $('.install-dependencies-package-container .type-' + type).removeClass('hidden');
        let list = $('.install-dependencies-package-container .type-' + type + ' ul');
        let text = `${dependency}`;
        list.append(`<li>${text}</li>`);
    }

    getPackagesDependencies(type, slugs, finishedLoadingCallback) {
        let url = Packages.getGetPackagesDependenciesUrl(type);

        request(url, {
            method: 'post',
            body: {
                packages: slugs
            }
        }, (response) => {

            finishedLoadingCallback();

            if (response.status === 'success') {
                if (response.dependencies) {
                    let hasDependencies = false;
                    for (var dependency in response.dependencies) {
                        if (response.dependencies.hasOwnProperty(dependency)) {
                            hasDependencies = true;
                            let dependencyName = dependency;
                            let dependencyType = response.dependencies[dependency];

                            Packages.addNeededDependencyToList(dependencyType, dependencyName);
                        }
                    }

                    if (hasDependencies) {
                        $('[data-packages-modal] .install-dependencies-package-container').removeClass('hidden');
                    } else {
                        $('[data-packages-modal] .install-package-container').removeClass('hidden');
                    }
                } else {
                    $('[data-packages-modal] .install-package-container').removeClass('hidden');
                }
            } else {
                $('[data-packages-modal] .install-package-error').removeClass('hidden');
            }
        });
    }

    installDependenciesOfPackages(type, slugs, callbackSuccess, callbackError) {
        let url = Packages.getInstallDependenciesOfPackagesUrl(type);

        request(url, {
            method: 'post',
            body: {
                packages: slugs
            }
        }, callbackSuccess);
    }

    installPackages(type, slugs, callbackSuccess) {
        let url = Packages.getInstallPackageUrl(type);

        slugs.forEach((slug) => {
            request(url, {
                method: 'post',
                body: {
                    package: slug,
                    type: type
                }
            }, callbackSuccess);
        });

    }

    static getSlugsFromEvent(event) {
        let slugs = '';
        if ($(event.target).is('[data-packages-slugs]')) {
            slugs = $(event.target).attr('data-packages-slugs');
        } else {
            slugs = $(event.target).parent('[data-packages-slugs]').attr('data-packages-slugs');
        }

        if (typeof slugs === 'undefined') {
            return null;
        }

        slugs = slugs.split(',');
        return typeof slugs === 'string' ? [slugs] : slugs;
    }

    handleGettingPackageDependencies(type, event) {
        let slugs = Packages.getSlugsFromEvent(event);

        if (!slugs) {
            alert('No slug set');
            return;
        }

        // Cleanup
        $('.packages-names-list').html('');
        $('.install-dependencies-package-container li').remove();

        slugs.forEach((slug) => {
            $('.packages-names-list').append(`<li>${slug}</li>`);
        });

        event.preventDefault();
        event.stopPropagation();

        // Restore original state
        $('[data-packages-modal] .loading').removeClass('hidden');
        $('[data-packages-modal] .install-dependencies-package-container').addClass('hidden');
        $('[data-packages-modal] .install-package-container').addClass('hidden');
        $('[data-packages-modal] .installing-dependencies').addClass('hidden');
        $('[data-packages-modal] .installing-package').addClass('hidden');
        $('[data-packages-modal] .installation-complete').addClass('hidden');
        $('[data-packages-modal] .install-package-error').addClass('hidden');

        this.getPackagesDependencies(type, slugs, () => {
            let slugs_string = slugs.join();
            $(`[data-packages-modal] [data-${type}-action="install-dependencies-and-package"]`).attr('data-packages-slugs', slugs_string);
            $(`[data-packages-modal] [data-${type}-action="install-package"]`).attr('data-packages-slugs', slugs_string);
            $('[data-packages-modal] .loading').addClass('hidden');
        });
    }

    handleInstallingDependenciesAndPackage(type, event) {
        let slugs = Packages.getSlugsFromEvent(event);
        event.preventDefault();
        event.stopPropagation();

        $('[data-packages-modal] .install-dependencies-package-container').addClass('hidden');
        $('[data-packages-modal] .installing-dependencies').removeClass('hidden');

        this.installDependenciesOfPackages(type, slugs, () => {
            $('[data-packages-modal] .installing-dependencies').addClass('hidden');
            $('[data-packages-modal] .installing-package').removeClass('hidden');
            this.installPackages(type, slugs, () => {
                $('[data-packages-modal] .installing-package').addClass('hidden');
                $('[data-packages-modal] .installation-complete').removeClass('hidden');

                if (slugs.length === 1) {
                    window.location.href = `${config.base_url_relative}/${type}s/${slugs[0]}`;
                } else {
                    window.location.href = `${config.base_url_relative}/${type}s`;
                }

            });
        });
    }

    handleInstallingPackage(type, event) {
        let slugs = Packages.getSlugsFromEvent(event);
        event.preventDefault();
        event.stopPropagation();

        $('[data-packages-modal] .install-package-container').addClass('hidden');
        $('[data-packages-modal] .installing-package').removeClass('hidden');

        this.installPackages(type, slugs, () => {
            $('[data-packages-modal] .installing-package').addClass('hidden');
            $('[data-packages-modal] .installation-complete').removeClass('hidden');

            if (slugs.length === 1) {
                window.location.href = `${config.base_url_relative}/${type}s/${slugs[0]}`;
            } else {
                window.location.href = `${config.base_url_relative}/${type}s`;
            }
        });
    }

    handleRemovingPackage(type, event) {
        let slug = $(event.target).attr('data-packages-slugs');
        event.preventDefault();
        event.stopPropagation();

        this.removePackage(type, slug);
    }

    handleRemovingDependency(type, event) {
        let slug = $(event.target).attr('data-dependency-slug');
        let button = $(event.target);
        event.preventDefault();
        event.stopPropagation();

        this.removeDependency(type, slug, button);
    }

}

export default new Packages();
